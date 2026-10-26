// Servicio de exportacion (CSV y XLSX).
//
// Flujo de una exportacion:
//
//   1. Limites de uso (por usuario y globales) fuera del bloque auditado: un
//      429 no es un intento de exportacion y no ensucia la auditoria.
//   2. Validacion de permiso, conjunto, formato y rango. Un 4xx de validacion
//      tampoco genera evento: no se ha intentado leer datos.
//   3. Generacion: se leen las filas ya normalizadas por el catalogo, se
//      comprueban los topes y se escribe la auditoria de exito ANTES de enviar
//      el archivo (asi su fecha siempre es anterior al fin de la respuesta).
//      Cualquier fallo aqui deja `exportacion_fallida` y se propaga.
//   4. Envio: CSV completo o libro XLSX en streaming (sin tocar disco).
//
// El detalle de auditoria lleva solo metadatos (conjuntos, formato, filtros y
// filas por conjunto). Nunca las filas exportadas.
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaRepository } from '../auditoria/infrastructure/auditoria.repository';
import { CATALOGO_EXPORTS } from './application/catalogo';
import type { FilaExport, UsuarioExport } from './application/catalogo.impl';
import {
  CONJUNTOS,
  MAX_FILAS_POR_CONJUNTO,
  MAX_FILAS_TOTALES,
  exigeRango,
  validarRangoExport,
  type ConjuntoExport,
  type FormatoExport,
} from './domain/limites';
import { construirCsv } from './domain/csv';
import { crearLibroStreaming, filaCelda, prepararHoja } from './domain/excel';
import { fechaLocalDe } from '../sales/domain/rules/fechas';

const USER_CONCURRENT = new Map<string, number>();
let GLOBAL_COUNT = 0;
const USER_MINUTE = new Map<string, { count: number; resetAt: number }>();

const FORMATOS_VALIDOS: readonly string[] = ['xlsx', 'csv'];

function make429(mensaje: string): HttpException {
  return new HttpException(mensaje, HttpStatus.TOO_MANY_REQUESTS);
}

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const rec = USER_MINUTE.get(userId);
  if (!rec || now > rec.resetAt) {
    USER_MINUTE.set(userId, { count: 1, resetAt: now + 60_000 });
  } else {
    if (rec.count >= 10) {
      throw make429('Límite de 10 exportaciones por minuto');
    }
    rec.count += 1;
  }
}

function checkConcurrent(userId: string): { release: () => void } {
  if ((USER_CONCURRENT.get(userId) ?? 0) >= 1) {
    throw make429('Ya hay una exportación en curso');
  }
  if (GLOBAL_COUNT >= 2) {
    throw make429('Límite global de exportaciones concurrentes');
  }
  USER_CONCURRENT.set(userId, (USER_CONCURRENT.get(userId) ?? 0) + 1);
  GLOBAL_COUNT += 1;

  return {
    release: () => {
      USER_CONCURRENT.set(
        userId,
        Math.max(0, (USER_CONCURRENT.get(userId) ?? 0) - 1),
      );
      GLOBAL_COUNT = Math.max(0, GLOBAL_COUNT - 1);
    },
  };
}

type HojaExport = {
  nombre: string;
  columnas: readonly string[];
  filas: FilaExport[];
};

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  async exportSingle(
    res: Response,
    user: UsuarioExport,
    body: {
      conjunto?: string;
      formato?: string;
      filtros?: Record<string, unknown>;
    },
  ): Promise<void> {
    const usuarioId = idDe(user);
    checkRateLimit(usuarioId);
    const rel = checkConcurrent(usuarioId);

    try {
      // ------------------------------------------------------- validaciones
      const permisos = permisosDe(user);
      if (!permisos.includes('usuarios.crear_editar')) {
        throw new ForbiddenException('Sin permiso');
      }

      const conjunto = body?.conjunto;
      if (!esConjuntoValido(conjunto)) {
        throw new BadRequestException('Conjunto inválido');
      }

      const item = CATALOGO_EXPORTS[conjunto];
      if (!permisos.includes(item.permisoLectura)) {
        throw new ForbiddenException('Sin permiso');
      }

      const formato = (body?.formato ?? 'xlsx') as FormatoExport;
      if (!FORMATOS_VALIDOS.includes(formato)) {
        throw new BadRequestException('Formato inválido');
      }

      const filtros = body?.filtros ?? {};
      if (exigeRango(conjunto)) {
        try {
          validarRangoExport(conjunto, filtros);
        } catch (error) {
          throw new BadRequestException((error as Error).message);
        }
      }

      // ------------------------------------------------------- generacion
      try {
        const { datos, total } = await item.obtenerDatos(
          this.prisma,
          user,
          filtros,
        );

        if (total > MAX_FILAS_POR_CONJUNTO) {
          throw new BadRequestException(
            `Límite excedido: máximo ${MAX_FILAS_POR_CONJUNTO} filas por conjunto`,
          );
        }

        const filasPorConjunto = { [conjunto]: total };
        await this.auditar(user, 'exportacion_generada', {
          conjuntos: [conjunto],
          formato,
          filtros,
          filasPorConjunto,
        });

        const nombre = `${conjunto}-${fechaLocalDe(new Date())}`;
        if (formato === 'csv') {
          escribirCsv(res, item.columnas, datos, nombre);
        } else {
          await escribirLibro(
            res,
            [
              {
                nombre: item.etiqueta,
                columnas: item.columnas,
                filas: datos,
              },
            ],
            `${nombre}.xlsx`,
          );
        }
      } catch (error) {
        await this.auditarSeguro(user, 'exportacion_fallida', {
          conjuntos: [conjunto],
          formato,
          filtros,
          filasPorConjunto: {},
        });
        if (res.headersSent) {
          res.destroy(error as Error);
          return;
        }
        throw error;
      }
    } finally {
      rel.release();
    }
  }

  async exportFull(res: Response, user: UsuarioExport): Promise<void> {
    const usuarioId = idDe(user);
    checkRateLimit(usuarioId);
    const rel = checkConcurrent(usuarioId);

    try {
      const permisos = permisosDe(user);
      if (!permisos.includes('usuarios.crear_editar')) {
        throw new ForbiddenException('Sin permiso');
      }

      const conjuntos = CONJUNTOS.filter((conjunto) =>
        permisos.includes(CATALOGO_EXPORTS[conjunto].permisoLectura),
      );
      const omitidos = CONJUNTOS.filter(
        (conjunto) => !conjuntos.includes(conjunto),
      );

      try {
        const resultados: Array<{
          conjunto: ConjuntoExport;
          item: any;
          datos: FilaExport[];
          total: number;
        }> = [];
        const filasPorConjunto: Record<string, number> = {};
        let totalGlobal = 0;

        for (const conjunto of conjuntos) {
          const item = CATALOGO_EXPORTS[conjunto];
          const { datos, total } = await item.obtenerDatos(
            this.prisma,
            user,
            {},
          );

          if (total > MAX_FILAS_POR_CONJUNTO) {
            throw new BadRequestException(
              `Límite excedido: máximo ${MAX_FILAS_POR_CONJUNTO} filas por conjunto`,
            );
          }

          totalGlobal += total;
          filasPorConjunto[conjunto] = total;

          if (totalGlobal > MAX_FILAS_TOTALES) {
            throw new BadRequestException(
              `Límite excedido: máximo ${MAX_FILAS_TOTALES} filas totales`,
            );
          }

          resultados.push({ conjunto, item, datos, total });
        }

        const conjuntosIncluidos = resultados.map(
          (resultado) => resultado.conjunto,
        );

        await this.auditar(user, 'exportacion_generada', {
          conjuntos: conjuntosIncluidos,
          formato: 'xlsx',
          filtros: {},
          filasPorConjunto,
        });

        const metadatos: FilaExport[] = [
          {
            Campo: 'Exportador',
            Valor: user.nombre ?? user.nombreUsuario ?? usuarioId,
          },
          { Campo: 'Fecha', Valor: fechaHoraLima(new Date()) },
          {
            Campo: 'Conjuntos incluidos',
            Valor: etiquetasDe(conjuntosIncluidos),
          },
          {
            Campo: 'Conjuntos omitidos',
            Valor: etiquetasDe(omitidos),
          },
          { Campo: 'Filas totales', Valor: totalGlobal },
        ];

        const hojas: HojaExport[] = [
          {
            nombre: 'Metadatos',
            columnas: ['Campo', 'Valor'],
            filas: metadatos,
          },
          ...resultados.map((resultado) => ({
            nombre: resultado.item.etiqueta,
            columnas: resultado.item.columnas,
            filas: resultado.datos,
          })),
        ];

        await escribirLibro(
          res,
          hojas,
          `libro-completo-${fechaLocalDe(new Date())}.xlsx`,
        );
      } catch (error) {
        await this.auditarSeguro(user, 'exportacion_fallida', {
          conjuntos: [...conjuntos],
          formato: 'xlsx',
          filtros: {},
          filasPorConjunto: {},
        });
        if (res.headersSent) {
          res.destroy(error as Error);
          return;
        }
        throw error;
      }
    } finally {
      rel.release();
    }
  }

  // --------------------------------------------------------------- auditoria

  /** Escribe el evento de exito. Si falla, lo captura el bloque de generacion. */
  private async auditar(
    user: UsuarioExport,
    accion: 'exportacion_generada' | 'exportacion_fallida',
    detalle: Record<string, unknown>,
  ): Promise<void> {
    await this.auditoria.registrar({
      entidad: 'exportacion',
      // La columna es un UUID sin FK: identifica esta exportacion concreta.
      entidadId: randomUUID(),
      accion,
      actorId: idDe(user),
      detalle: detalle as any,
    });
  }

  /**
   * Intenta dejar `exportacion_fallida` sin tapar el error original. Si la
   * propia auditoria falla (por ejemplo, la base se cayo), se ignora: lo que
   * importa es propagar el fallo que vivio el usuario.
   */
  private async auditarSeguro(
    user: UsuarioExport,
    accion: 'exportacion_generada' | 'exportacion_fallida',
    detalle: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditar(user, accion, detalle);
    } catch {
      // Intencionalmente silencioso.
    }
  }
}

// ---------------------------------------------------------------- utilidades

function idDe(user: UsuarioExport): string {
  return user.id;
}

function permisosDe(user: UsuarioExport): string[] {
  return user.permisosEfectivos ?? user.permisos ?? [];
}

function esConjuntoValido(valor: unknown): valor is ConjuntoExport {
  return (
    typeof valor === 'string' &&
    (CONJUNTOS as readonly string[]).includes(valor)
  );
}

/** Etiquetas legibles de una lista de conjuntos, conservando el orden. */
function etiquetasDe(conjuntos: readonly string[]): string {
  return conjuntos
    .map((conjunto) => CATALOGO_EXPORTS[conjunto]?.etiqueta ?? conjunto)
    .join(', ');
}

/** "AAAA-MM-DD HH:mm" en America/Lima, sin depender del formato del sistema. */
function fechaHoraLima(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(fecha)
    .replace(', ', ' ');
}

function escribirCsv(
  res: Response,
  columnas: readonly string[],
  filas: FilaExport[],
  nombre: string,
): void {
  const csv = construirCsv(
    columnas,
    filas.map((fila) => columnas.map((columna) => fila[columna] ?? null)),
  );

  // Nest responde 201 por defecto a un POST; una descarga es un 200.
  res.status(200);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${nombre}.csv"`,
  );
  res.end(csv);
}

/**
 * Escribe un libro XLSX en streaming directamente sobre la respuesta.
 *
 * No pasa por disco: el `PassThrough` del dominio se conecta a `res`. Las filas
 * se confirman una a una para que el workbook no las retenga en memoria.
 */
async function escribirLibro(
  res: Response,
  hojas: readonly HojaExport[],
  nombreArchivo: string,
): Promise<void> {
  // Nest responde 201 por defecto a un POST; una descarga es un 200.
  res.status(200);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${nombreArchivo}"`,
  );

  const { workbook, stream } = crearLibroStreaming();
  stream.pipe(res);

  for (const hoja of hojas) {
    const worksheet = workbook.addWorksheet(hoja.nombre);
    prepararHoja(
      worksheet,
      hoja.columnas.map((columna) => ({ header: columna })),
    );

    for (const fila of hoja.filas) {
      const filaExcel = worksheet.addRow(
        filaCelda(hoja.columnas.map((columna) => fila[columna] ?? null)),
      );
      if (typeof (filaExcel as any).commit === 'function') {
        (filaExcel as any).commit();
      }
    }
  }

  // Finaliza las hojas, cierra el stream y, con el, la respuesta HTTP.
  await workbook.commit();
}
