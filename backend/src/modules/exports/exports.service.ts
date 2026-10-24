import { Injectable, ForbiddenException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaRepository } from '../auditoria/infrastructure/auditoria.repository';
import { CATALOGO_EXPORTS } from './application/catalogo';
import { CONJUNTOS, MAX_FILAS_POR_CONJUNTO, MAX_FILAS_TOTALES, FILAS_POR_LOTE, exigeRango, validarRangoExport } from './domain/limites';
import { serializeCsv } from './domain/csv';
import { createWorkbookWriter } from './domain/excel';
import { getEtiquetaConjunto } from './domain/etiquetas';
import { PassThrough } from 'stream';
import { Response } from 'express';

const USER_CONCURRENT = new Map<string, number>();
let GLOBAL_COUNT = 0;
const USER_MINUTE = new Map<string, { count: number; resetAt: number }>();

function make429(msg: string) {
  return new HttpException(msg, HttpStatus.TOO_MANY_REQUESTS);
}

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const rec = USER_MINUTE.get(userId);
  if (!rec || now > rec.resetAt) {
    USER_MINUTE.set(userId, { count: 1, resetAt: now + 60000 });
  } else {
    if (rec.count >= 10) {
      throw make429('Límite de 10 exportaciones por minuto');
    }
    rec.count++;
  }
}

function checkConcurrent(userId: string): { release: () => void } {
  if ((USER_CONCURRENT.get(userId) || 0) >= 1) {
    throw make429('Ya hay una exportación en curso');
  }
  if (GLOBAL_COUNT >= 2) {
    throw make429('Límite global de exportaciones concurrentes');
  }
  USER_CONCURRENT.set(userId, (USER_CONCURRENT.get(userId) || 0) + 1);
  GLOBAL_COUNT++;
  return {
    release: () => {
      USER_CONCURRENT.set(userId, Math.max(0, (USER_CONCURRENT.get(userId) || 0) - 1));
      GLOBAL_COUNT = Math.max(0, GLOBAL_COUNT - 1);
    },
  };
}

@Injectable()
export class ExportsService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaRepository,
  ) {}

  async exportSingle(
    res: Response,
    user: any,
    body: { conjunto: string; formato: 'xlsx' | 'csv'; filtros?: any },
  ): Promise<void> {
    checkRateLimit(user.sub || user.id);
    let rel: any = checkConcurrent(user.sub || user.id);
    try {
      const conjunto = body.conjunto as any;
      if (!CONJUNTOS.includes(conjunto)) throw new BadRequestException('Conjunto inválido');
      const item = CATALOGO_EXPORTS[conjunto];
      if (!user.permisos?.includes('usuarios.crear_editar')) throw new ForbiddenException('Sin permiso');
      if (!user.permisos?.includes(item.permisoLectura)) throw new ForbiddenException('Sin permiso');
      
      if (exigeRango(conjunto)) {
        validarRangoExport(conjunto, body.filtros || {});
      }
      
      const { datos, total } = await item.obtenerDatos(this.prisma, user, body.filtros || {});
      if (total > MAX_FILAS_POR_CONJUNTO) throw new BadRequestException(`Límite excedido: máximo ${MAX_FILAS_POR_CONJUNTO} filas por conjunto`);
      
      await this.auditoria.crear({
        usuarioId: user.sub || user.id,
        accion: 'exportacion_generada' as any,
        entidad: 'exportacion' as any,
        entidadId: null as any,
        detalle: { conjuntos: [conjunto], formato: body.formato, filtros: body.filtros || {}, filasPorConjunto: { [conjunto]: total } },
      });
      
      const fecha = new Date().toISOString().split('T')[0];
      if (body.formato === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${conjunto}-${fecha}.csv"`);
        const headers = item.columnas;
        let csv = serializeCsv(headers, datos.map((d: any) => headers.map((h: string) => d[h] ?? '')));
        res.write(csv);
        res.end();
      } else {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${conjunto}-${fecha}.xlsx"`);
        const stream = new PassThrough();
        stream.pipe(res);
        const writer = createWorkbookWriter(stream);
        const ws = writer.addWorksheet(getEtiquetaConjunto(conjunto));
        ws.addRow(item.columnas);
        for (const row of datos) {
          ws.addRow(item.columnas.map((h: string) => row[h] ?? ''));
        }
        await writer.commit();
      }
    } catch (e: any) {
      try {
        await this.auditoria.crear({
          usuarioId: user.sub || user.id,
          accion: 'exportacion_fallida' as any,
          entidad: 'exportacion' as any,
          entidadId: null as any,
          detalle: { conjuntos: [body.conjunto], formato: body.formato, filtros: body.filtros || {}, filasPorConjunto: {} },
        });
      } catch {}
      throw e;
    } finally {
      if (rel && typeof rel.release === 'function') rel.release();
    }
  }

  async exportFull(
    res: Response,
    user: any,
  ): Promise<void> {
    checkRateLimit(user.sub || user.id);
    let rel: any = checkConcurrent(user.sub || user.id);
    try {
      if (!user.permisos?.includes('usuarios.crear_editar')) throw new ForbiddenException('Sin permiso');
      
      const conjuntos = CONJUNTOS.filter(c => {
        const item = CATALOGO_EXPORTS[c];
        return user.permisos?.includes(item.permisoLectura);
      });
      
      let totalGlobal = 0;
      const resultados: any[] = [];
      for (const c of conjuntos) {
        const item = CATALOGO_EXPORTS[c];
        const { datos, total } = await item.obtenerDatos(this.prisma, user, {});
        totalGlobal += total;
        if (totalGlobal > MAX_FILAS_TOTALES) throw new BadRequestException(`Límite excedido: máximo ${MAX_FILAS_TOTALES} filas totales`);
        resultados.push({ c, item, datos, total });
      }
      
      await this.auditoria.crear({
        usuarioId: user.sub || user.id,
        accion: 'exportacion_generada' as any,
        entidad: 'exportacion' as any,
        entidadId: null as any,
        detalle: { conjuntos: resultados.map(r => r.c), formato: 'xlsx', filtros: {}, filasPorConjunto: Object.fromEntries(resultados.map(r => [r.c, r.total])) },
      });
      
      const fecha = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="libro-completo-${fecha}.xlsx"`);
      const stream = new PassThrough();
      stream.pipe(res);
      const writer = createWorkbookWriter(stream);
      const wsMeta = writer.addWorksheet('Metadatos');
      wsMeta.addRow(['Exportador', user.nombre || user.nombreUsuario || user.sub]);
      wsMeta.addRow(['Fecha', new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })]);
      wsMeta.addRow(['Conjuntos incluidos', resultados.map(r => r.c).join(', ')]);
      wsMeta.addRow(['Conjuntos omitidos', CONJUNTOS.filter(c => !conjuntos.includes(c)).join(', ')]);
      wsMeta.addRow(['Filas totales', totalGlobal]);
      
      for (const r of resultados) {
        const ws = writer.addWorksheet(getEtiquetaConjunto(r.c));
        ws.addRow(r.item.columnas);
        for (const row of r.datos) {
          ws.addRow(r.item.columnas.map((h: string) => row[h] ?? ''));
        }
      }
      await writer.commit();
    } catch (e: any) {
      try {
        await this.auditoria.crear({
          usuarioId: user.sub || user.id,
          accion: 'exportacion_fallida' as any,
          entidad: 'exportacion' as any,
          entidadId: null as any,
          detalle: { conjuntos: [], formato: 'xlsx', filtros: {}, filasPorConjunto: {} },
        });
      } catch {}
      throw e;
    } finally {
      if (rel && typeof rel.release === 'function') rel.release();
    }
  }
}
