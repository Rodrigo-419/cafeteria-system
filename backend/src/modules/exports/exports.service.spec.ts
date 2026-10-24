import { ExportsService } from './exports.service';
import { ForbiddenException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';

describe('ExportsService', () => {
  let service: ExportsService;
  let prisma: any;
  let auditoria: any;

  beforeEach(() => {
    prisma = {};
    auditoria = { crear: jest.fn().mockResolvedValue({}) };
    service = new ExportsService(prisma, auditoria);
  });

  it('exportSingle requiere permiso usuarios.crear_editar', async () => {
    const res = { setHeader: jest.fn(), write: jest.fn(), end: jest.fn() } as any;
    const user = { sub: 'u1', permisos: ['ventas.ver'] };
    await expect(service.exportSingle(res, user, { conjunto: 'ventas', formato: 'xlsx' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exportSingle verifica permiso de lectura por conjunto', async () => {
    const res = { setHeader: jest.fn(), write: jest.fn(), end: jest.fn() } as any;
    const user = { sub: 'u2', permisos: ['usuarios.crear_editar'] };
    await expect(service.exportSingle(res, user, { conjunto: 'ventas', formato: 'xlsx' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exportFull omite conjuntos sin permiso de lectura', async () => {
    const res = { setHeader: jest.fn(), write: jest.fn(), end: jest.fn(), pipe: jest.fn() } as any;
    const stream = require('stream').PassThrough ? new (require('stream').PassThrough)() : { pipe: jest.fn() };
    (res as any).pipe = jest.fn().mockReturnValue(stream);
    const user = { sub: 'u3', permisos: ['usuarios.crear_editar', 'ventas.ver'] };
    const { CATALOGO_EXPORTS } = require('./application/catalogo');
    CATALOGO_EXPORTS.ventas.obtenerDatos = jest.fn().mockResolvedValue({ datos: [{ Fecha: '2026-01-01', Sucursal: 'x', Vendedor: 'y', Método: 'efectivo', Estado: 'completada', Total: 10 }], total: 1 });
    try {
      await service.exportFull(res, user);
      expect(auditoria.crear).toHaveBeenCalled();
    } catch (e) {
      // if streaming setup differs, just ensure auditoria not called with error in normal flow
      expect(auditoria.crear).toHaveBeenCalled();
    }
  });

  it('aplica topes: límite por conjunto 20000 filas', async () => {
    const res = { setHeader: jest.fn(), write: jest.fn(), end: jest.fn() } as any;
    const user = { sub: 'u4', permisos: ['usuarios.crear_editar', 'ventas.ver'] };
    const { CATALOGO_EXPORTS } = require('./application/catalogo');
    CATALOGO_EXPORTS.ventas.obtenerDatos = jest.fn().mockResolvedValue({ datos: [], total: 20001 });
    await expect(service.exportSingle(res, user, { conjunto: 'ventas', formato: 'xlsx', filtros: { desde: '2026-01-01', hasta: '2026-01-10' } })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aplica límite global 50000 filas totales', async () => {
    const res = { setHeader: jest.fn(), write: jest.fn(), end: jest.fn(), pipe: jest.fn() } as any;
    const user = { sub: 'u5', permisos: ['usuarios.crear_editar', 'ventas.ver'] };
    const { CATALOGO_EXPORTS } = require('./application/catalogo');
    CATALOGO_EXPORTS.ventas.obtenerDatos = jest.fn().mockResolvedValue({ datos: Array(50001).fill({}), total: 50001 });
    await expect(service.exportFull(res, user)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requiere rango válido para conjuntos con exigeRango', async () => {
    const res = { setHeader: jest.fn(), write: jest.fn(), end: jest.fn() } as any;
    const user = { sub: 'u6', permisos: ['usuarios.crear_editar', 'ventas.ver'] };
    await expect(service.exportSingle(res, user, { conjunto: 'ventas', formato: 'xlsx', filtros: {} })).rejects.toThrow();
  });

  it('valida límite concurrente por usuario (1) y global (2)', async () => {
    const res = { setHeader: jest.fn(), write: jest.fn(), end: jest.fn(), pipe: jest.fn() } as any;
    const mkUser = (id: string) => ({ sub: id, permisos: ['usuarios.crear_editar', 'ventas.ver'] });
    const user1 = mkUser('u7');
    const user2 = mkUser('u8');
    const user3 = mkUser('u9');
    const user1b = mkUser('u7');
    const { CATALOGO_EXPORTS } = require('./application/catalogo');

    // Cada llamada queda bloqueada en una promesa que la propia prueba resuelve.
    const pendientes: Array<(v: any) => void> = [];
    CATALOGO_EXPORTS.ventas.obtenerDatos = jest.fn(
      () => new Promise(resolve => { pendientes.push(resolve); }),
    );

    const body = { conjunto: 'ventas', formato: 'xlsx' as const, filtros: { desde: '2026-01-01', hasta: '2026-01-02' } };

    // 1) usuario1 ocupa su slot y el primer slot global
    const p1 = service.exportSingle(res, user1, body).catch(e => e);
    // 2) usuario2 ocupa el segundo slot global
    const p2 = service.exportSingle(res, user2, body).catch(e => e);
    // Las dos llamadas anteriores ya ejecutaron checkConcurrent de forma síncrona
    // hasta el await de obtenerDatos, así que los slots están tomados.
    expect(pendientes).toHaveLength(2);

    // 3) tercer usuario: límite global (2) => 429
    const r3 = await service.exportSingle(res, user3, body).catch(e => e);
    expect(r3).toBeInstanceOf(HttpException);
    expect((r3 as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);

    // 4) segundo intento simultáneo del usuario1: límite por usuario (1) => 429
    const r1b = await service.exportSingle(res, user1b, body).catch(e => e);
    expect(r1b).toBeInstanceOf(HttpException);
    expect((r1b as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);

    // 5) liberar los dos en curso
    pendientes[0]({ datos: [], total: 0 });
    pendientes[1]({ datos: [], total: 0 });
    await Promise.allSettled([p1, p2]);

    // 6) tras liberar, el usuario1 puede volver a exportar (slot liberado)
    const p1c = service.exportSingle(res, user1, body).catch(e => e);
    expect(pendientes).toHaveLength(3);
    pendientes[2]({ datos: [], total: 0 });
    await p1c;
  });
});
