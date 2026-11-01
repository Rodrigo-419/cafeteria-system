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
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaRepository } from '../auditoria/infrastructure/auditoria.repository';
import { CATALOGO_EXPORTS } from './application/catalogo';
import type { FilaExport, UsuarioExport } from './application/catalogo.impl';
import {
  CONJUNTOS,
  ErrorRangoExport,
  LIMITES_EXPORT_POR_DEFECTO,
  exigeRango,
  validarRangoExport,
  type ConjuntoExport,
  type FormatoExport,
  type LimitesExport,
} from './domain/limites';
import { construirCsv } from './domain/csv';
import { crearLibroStreaming, filaCelda, prepararHoja } from './domain/excel';
import { fechaLocalDe } from '../sales/domain/rules/fechas';

/** Token para inyectar límites distintos en pruebas y despliegues. */
export const LIMITES_EXPORT = Symbol('LIMITES_EXPORT');

/** Opciones del servicio: topes y reloj (para las ventanas de 60 s). */
export type OpcionesExport = Partial<LimitesExport> & {
  ahora?: () => number;
};

const FORMATOS_VALIDOS: readonly string[] = ['xlsx', 'csv'];

/** Los conjuntos de actividad sí aceptan rango; los demás, no. */
const SUGERENCIA_RANGO = 'Acota el rango de fechas.';
const SIN_FILTRO =
  'Este conjunto no admite filtro por rango de fechas; reduce el volumen de datos.';

function sugerenciaDeConjunto(conjunto: ConjuntoExport): string {
  return exigeRango(conjunto) ? SUGERENCIA_RANGO : SIN_FILTRO;
}

/**
 * En el libro completo no hay filtros por conjunto. Si el conjunto es de
 * actividad, exportarlo por separado permite acotar fechas; si no, solo queda
 * reducir el volumen de datos.
 */
function sugerenciaDeLibro(conjunto: ConjuntoExport): string {
  return exigeRango(conjunto)
    ? 'El libro completo no admite filtros; exporta este conjunto por separado y acota el rango de fechas.'
    : 'El libro completo no admite filtros; este conjunto no admite filtro por rango de fechas; reduce el volumen de datos.';
}

function make429(mensaje: string): HttpException {
  return new HttpException(mensaje, HttpStatus.TOO_MANY_REQUESTS);
}

function make413(mensaje: string): HttpException {
  return new HttpException(mensaje, HttpStatus.PAYLOAD_TOO_LARGE);
}

/** Motivo legible para el detalle de `exportacion_fallida`. */
function motivoDe(error: unknown): string {
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return String(error);
}

type HojaExport = {
  nombre: string;
  columnas: readonly string[];
  filas: FilaExport[];
};

/** Motivo por el que se abandona una exportación en curso. */
type MotivoCorte = 'cliente' | 'tiempo';

/**
 * Corte de la exportación: el cliente cerró la conexión o venció el plazo.
 *
 * No es un error del usuario ni del servidor: la exportación simplemente se
 * abandona, se registra `exportacion_fallida` y se libera la ranura.
 */
class ExportacionCortada extends Error {
  constructor(
    readonly motivo: MotivoCorte,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ExportacionCortada';
  }
}

/** Vigilancia de una exportación mientras se genera y se envía. */
type Vigilancia = {
  senal: AbortSignal;
  cortada: () => ExportacionCortada | null;
  terminar: () => void;
};

/**
 * Detalle de la exportación que se va completando sobre la marcha.
 *
 * Vive fuera del `try` para que el fallo (incluido el corte) se pueda auditar
 * con los datos que ya se conocían, sin repetir la lectura.
 */
type ContextoExport = {
  /** `true` desde que empieza la lectura de datos hasta que termina el envío. */
  enGeneracion: boolean;
  conjuntos: string[];
  formato: FormatoExport;
  filtros: Record<string, unknown>;
  filasPorConjunto: Record<string, number>;
};

/** "60 s" o "0,3 s", en español. */
function segundosLegibles(ms: number): string {
  const segundos = ms / 1000;
  const texto = Number.isInteger(segundos)
    ? String(segundos)
    : segundos.toFixed(1).replace('.', ',');
  return `${texto} s`;
}

function mensajeDeTiempo(ms: number): string {
  return (
    `La exportación superó el tiempo máximo de ${segundosLegibles(ms)} y se ` +
    'canceló. Inténtalo de nuevo o reduce el volumen de datos.'
  );
}

/**
 * Prepara el corte de la exportación:
 *
 *   * el plazo (`tiempoMaximoMs`) se cumple aunque la lectura siga esperando;
 *   * el cierre de la respuesta (el cliente se fue) también corta.
 *
 * Escucha `close` porque es el único evento que llega cuando el navegador
 * cancela la petición; `res.writableEnded` distingue el cierre normal.
 */
function vigilar(res: Response, tiempoMaximoMs: number): Vigilancia {
  const control = new AbortController();
  let corte: ExportacionCortada | null = null;

  const temporizador = setTimeout(() => {
    corte = new ExportacionCortada('tiempo', mensajeDeTiempo(tiempoMaximoMs));
    control.abort(corte);
  }, tiempoMaximoMs);
  temporizador.unref?.();

  const alCerrar = () => {
    if (corte !== null || res.writableEnded) return;
    corte = new ExportacionCortada(
      'cliente',
      'El cliente cortó la descarga antes de terminar.',
    );
    control.abort(corte);
  };
  res.once('close', alCerrar);

  return {
    senal: control.signal,
    cortada: () => corte,
    terminar: () => {
      clearTimeout(temporizador);
      res.off('close', alCerrar);
    },
  };
}

@Injectable()
export class ExportsService {
  private readonly limites: LimitesExport;
  private readonly ahora: () => number;
  private readonly concurrentesPorUsuario = new Map<string, number>();
  private concurrentesGlobales = 0;
  private readonly porMinuto = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaRepository,
    @Optional()
    @Inject(LIMITES_EXPORT)
    opciones: OpcionesExport = {},
  ) {
    const { ahora, ...limites } = opciones;
    this.limites = { ...LIMITES_EXPORT_POR_DEFECTO, ...limites };
    this.ahora = ahora ?? Date.now;
  }

  // -------------------------------------------------------------- limites

  /** Ventana deslizante fija de 60 s, con reloj inyectable en pruebas. */
  private checkRateLimit(usuarioId: string): void {
    const ahora = this.ahora();
    const registro = this.porMinuto.get(usuarioId);
    if (registro === undefined || ahora >= registro.resetAt) {
      this.porMinuto.set(usuarioId, { count: 1, resetAt: ahora + 60_000 });
      return;
    }

    if (registro.count >= this.limites.maxPorMinuto) {
      throw make429(
        `Límite de ${this.limites.maxPorMinuto} exportaciones por minuto. ` +
          'Espera un minuto antes de reintentar.',
      );
    }
    registro.count += 1;
  }

  private checkConcurrent(usuarioId: string): { release: () => void } {
    if (
      (this.concurrentesPorUsuario.get(usuarioId) ?? 0) >=
      this.limites.maxConcurrentesPorUsuario
    ) {
      throw make429(
        'Ya hay una exportación en curso. Espera a que termine.',
      );
    }
    if (this.concurrentesGlobales >= this.limites.maxConcurrentesGlobales) {
      throw make429(
        `Ya hay otra exportación en curso: el máximo global es ` +
          `${this.limites.maxConcurrentesGlobales}. Espera a que termine.`,
      );
    }

    this.concurrentesPorUsuario.set(
      usuarioId,
      (this.concurrentesPorUsuario.get(usuarioId) ?? 0) + 1,
    );
    this.concurrentesGlobales += 1;

    return {
      release: () => {
        this.concurrentesPorUsuario.set(
          usuarioId,
          Math.max(0, (this.concurrentesPorUsuario.get(usuarioId) ?? 0) - 1),
        );
        this.concurrentesGlobales = Math.max(0, this.concurrentesGlobales - 1);
      },
    };
  }

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
    this.checkRateLimit(usuarioId);
    const rel = this.checkConcurrent(usuarioId);
    const contexto: ContextoExport = {
      enGeneracion: false,
      conjuntos: [],
      formato: 'xlsx',
      filtros: {},
      filasPorConjunto: {},
    };

    await this.ejecutar(res, user, rel, contexto, (senal) =>
      this.procesarConjunto(res, user, body, senal, contexto),
    );
  }

  /** Valida, genera y envía un conjunto. Los fallos los audita `ejecutar`. */
  private async procesarConjunto(
    res: Response,
    user: UsuarioExport,
    body: {
      conjunto?: string;
      formato?: string;
      filtros?: Record<string, unknown>;
    },
    senal: AbortSignal,
    contexto: ContextoExport,
  ): Promise<void> {
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
        validarRangoExport(
          conjunto,
          filtros as { desde?: string; hasta?: string },
          this.limites.maxDiasRango,
        );
      } catch (error) {
        if (error instanceof ErrorRangoExport && error.motivo === 'excedido') {
          await this.auditarSeguro(user, 'exportacion_fallida', {
            conjuntos: [conjunto],
            formato,
            filtros,
            filasPorConjunto: {},
            motivo: error.message,
          });
          throw make413(error.message);
        }
        if (error instanceof ErrorRangoExport) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }
    }

    // ------------------------------------------------------- generacion
    contexto.enGeneracion = true;
    contexto.conjuntos = [conjunto];
    contexto.formato = formato;
    contexto.filtros = filtros;

    const { datos, total } = await item.obtenerDatos(
      this.prisma,
      user,
      filtros,
      { maxFilasPorConjunto: this.limites.maxFilasPorConjunto },
    );
    senal.throwIfAborted();

    contexto.filasPorConjunto = { [conjunto]: total };
    if (total > this.limites.maxFilasPorConjunto) {
      throw make413(
        `El conjunto "${conjunto}" supera el máximo de ` +
          `${this.limites.maxFilasPorConjunto} filas (se pidieron ${total}). ` +
          sugerenciaDeConjunto(conjunto),
      );
    }

    await this.auditar(user, 'exportacion_generada', {
      conjuntos: [conjunto],
      formato,
      filtros,
      filasPorConjunto: contexto.filasPorConjunto,
    });
    // La auditoría va antes del primer byte; si el corte llegó mientras se
    // escribía, ya no se envía nada.
    senal.throwIfAborted();

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
        senal,
      );
    }
  }

  async exportFull(res: Response, user: UsuarioExport): Promise<void> {
    const usuarioId = idDe(user);
    this.checkRateLimit(usuarioId);
    const rel = this.checkConcurrent(usuarioId);
    const contexto: ContextoExport = {
      enGeneracion: false,
      conjuntos: [],
      formato: 'xlsx',
      filtros: {},
      filasPorConjunto: {},
    };

    await this.ejecutar(res, user, rel, contexto, (senal) =>
      this.procesarLibro(res, user, senal, contexto),
    );
  }

  /** Valida, genera y envía el libro completo. Los fallos los audita `ejecutar`. */
  private async procesarLibro(
    res: Response,
    user: UsuarioExport,
    senal: AbortSignal,
    contexto: ContextoExport,
  ): Promise<void> {
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

    contexto.enGeneracion = true;
    contexto.conjuntos = [...conjuntos];
    contexto.formato = 'xlsx';
    contexto.filtros = {};

    const resultados: Array<{
      conjunto: ConjuntoExport;
      item: any;
      datos: FilaExport[];
      total: number;
    }> = [];
    let totalGlobal = 0;

    for (const conjunto of conjuntos) {
      senal.throwIfAborted();

      const item = CATALOGO_EXPORTS[conjunto];
      const { datos, total } = await item.obtenerDatos(
        this.prisma,
        user,
        {},
        { maxFilasPorConjunto: this.limites.maxFilasPorConjunto },
      );
      senal.throwIfAborted();

      contexto.filasPorConjunto[conjunto] = total;

      if (total > this.limites.maxFilasPorConjunto) {
        throw make413(
          `El conjunto "${conjunto}" supera el máximo de ` +
            `${this.limites.maxFilasPorConjunto} filas (se pidieron ${total}). ` +
            sugerenciaDeLibro(conjunto),
        );
      }

      totalGlobal += total;

      if (totalGlobal > this.limites.maxFilasTotales) {
        throw make413(
          `El libro completo supera el máximo de ` +
            `${this.limites.maxFilasTotales} filas (se pidieron ${totalGlobal}). ` +
            'El libro completo no admite filtros; exporta los conjuntos por separado.',
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
      filasPorConjunto: contexto.filasPorConjunto,
    });
    // La auditoría va antes del primer byte; si el corte llegó mientras se
    // escribía, ya no se envía nada.
    senal.throwIfAborted();

    const metadatos: FilaExport[] = [
      {
        Campo: 'Usuario',
        Valor: user.nombreUsuario ?? user.nombre ?? idDe(user),
      },
      {
        Campo: 'Exportador',
        Valor: user.nombre ?? user.nombreUsuario ?? idDe(user),
      },
      { Campo: 'Fecha y hora', Valor: fechaHoraLima(new Date()) },
      { Campo: 'Filtros', Valor: 'ninguno (libro completo)' },
      {
        Campo: 'Conjuntos incluidos',
        Valor: etiquetasDe(conjuntosIncluidos),
      },
      {
        Campo: 'Conjuntos omitidos',
        Valor: etiquetasDe(omitidos),
      },
      ...resultados.map((resultado) => ({
        Campo: `Filas: ${resultado.item.etiqueta}`,
        Valor: resultado.total,
      })),
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
      senal,
    );
  }

  /**
   * Envuelve una exportación: vigilancia, liberación de la ranura y auditoría
   * del fallo.
   *
   * La ranura se libera en el `finally`, antes de auditar, para que una
   * auditoría lenta no bloquee la siguiente exportación. Ese es justamente el
   * cuelgue que se corrige: antes, si el cliente cortaba la descarga, la
   * promesa del envío no terminaba nunca y `release()` no se ejecutaba.
   */
  private async ejecutar(
    res: Response,
    user: UsuarioExport,
    rel: { release: () => void },
    contexto: ContextoExport,
    trabajo: (senal: AbortSignal) => Promise<void>,
  ): Promise<void> {
    const vigilancia = vigilar(res, this.limites.tiempoMaximoMs);
    let fallo: unknown = null;
    let corte: ExportacionCortada | null = null;

    try {
      await this.conCorte(vigilancia, trabajo);
    } catch (error) {
      fallo = error;
      corte = vigilancia.cortada();
    } finally {
      vigilancia.terminar();
      rel.release();
    }

    if (fallo === null) return;

    // Un 4xx de validación no deja evento: todavía no se leyó ningún dato.
    // Solo se audita el fallo si ya se estaba generando o si hubo corte.
    if (contexto.enGeneracion || corte !== null) {
      await this.auditarSeguro(user, 'exportacion_fallida', {
        conjuntos: contexto.conjuntos,
        formato: contexto.formato,
        filtros: contexto.filtros,
        filasPorConjunto: contexto.filasPorConjunto,
        motivo: motivoDe(corte ?? fallo),
      });
    }

    if (corte !== null) {
      // Con el cliente fuera no hay a quién responder. Si el plazo venció
      // antes de enviar la cabecera, todavía se puede explicar el 503.
      if (corte.motivo === 'tiempo' && !res.headersSent && !res.destroyed) {
        throw new HttpException(corte.message, HttpStatus.SERVICE_UNAVAILABLE);
      }
      if (!res.destroyed && !res.writableEnded) {
        res.destroy();
      }
      return;
    }

    if (res.headersSent) {
      res.destroy(fallo as Error);
      return;
    }
    throw fallo;
  }

  /**
   * Corre el trabajo cooperando con el corte.
   *
   * Los `await` que no se pueden cancelar (Prisma no acepta `AbortSignal`) se
   * abandonan en cuanto llega el corte; el trabajo comprueba la señal en cada
   * frontera para no seguir escribiendo sobre una respuesta muerta.
   */
  private async conCorte<T>(
    vigilancia: Vigilancia,
    trabajo: (senal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const { senal } = vigilancia;
    senal.throwIfAborted();

    let rechazarPorCorte: (error: Error) => void = () => undefined;
    const cortada = new Promise<never>((_, rechazar) => {
      rechazarPorCorte = rechazar;
    });
    const alCortar = () => rechazarPorCorte(senal.reason as Error);

    senal.addEventListener('abort', alCortar, { once: true });
    try {
      return await Promise.race([trabajo(senal), cortada]);
    } finally {
      senal.removeEventListener('abort', alCortar);
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
 *
 * `pipeline` (y no `pipe`) es lo que garantiza que la exportación termine en
 * todos los caminos: si el cliente se va, el destino se destruye, el
 * `PassThrough` también y `commit()` deja de esperar. Con `pipe` a secas, el
 * `commit()` se quedaba esperando un flujo que ya nadie leía y la ranura de
 * concurrencia no se liberaba nunca.
 */
async function escribirLibro(
  res: Response,
  hojas: readonly HojaExport[],
  nombreArchivo: string,
  senal: AbortSignal,
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

  const bombeo = pipeline(stream, res);
  // El rechazo se observa más abajo con `await`; este `catch` evita además un
  // rechazo no controlado cuando el corte ya respondió.
  bombeo.catch(() => undefined);

  // Si el corte llega, el `PassThrough` se destruye y `pipeline` cierra `res`.
  const alCortar = () => {
    stream.destroy();
  };
  senal.addEventListener('abort', alCortar, { once: true });

  try {
    for (const hoja of hojas) {
      senal.throwIfAborted();

      const worksheet = workbook.addWorksheet(hoja.nombre);
      prepararHoja(
        worksheet,
        hoja.columnas.map((columna) => ({ header: columna })),
      );

      for (const fila of hoja.filas) {
        const filaExcel = worksheet.addRow(
          filaCelda(
            hoja.columnas.map((columna) => fila[columna] ?? null),
            hoja.columnas,
          ),
        );
        if (typeof (filaExcel as any).commit === 'function') {
          (filaExcel as any).commit();
        }
      }
    }

    senal.throwIfAborted();

    // Finaliza las hojas y cierra el `PassThrough`; el `pipeline` se encarga
    // de cerrar la respuesta HTTP.
    const finLibro = workbook.commit();
    finLibro.catch(() => undefined);

    // `commit()` puede quedarse esperando si el cliente ya no está: el corte
    // (o el rechazo del `pipeline`) libera la espera.
    await Promise.race([finLibro, bombeo]);
    await bombeo;
  } finally {
    senal.removeEventListener('abort', alCortar);
    stream.destroy();
  }
}
