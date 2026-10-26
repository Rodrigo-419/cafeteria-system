import { Writable } from 'node:stream';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CATALOGO_EXPORTS } from './application/catalogo';
import { CONJUNTOS } from './domain/limites';
import { ExportsService } from './exports.service';

/** Respuesta HTTP falsa: un Writable con `setHeader` y `destroy`. */
class RespuestaFalsa extends Writable {
  headers: Record<string, string> = {};
  cuerpo: Buffer[] = [];
  codigoHttp = 0;

  status(codigo: number): this {
    this.codigoHttp = codigo;
    return this;
  }

  setHeader(nombre: string, valor: string): this {
    this.headers[nombre] = valor;
    return this;
  }

  _write(
    chunk: Buffer,
    _codificacion: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.cuerpo.push(Buffer.from(chunk));
    callback();
  }
}

const obtenerDatosOriginales = new Map<string, any>();

describe('ExportsService', () => {
  let service: ExportsService;
  let prisma: any;
  let auditoria: any;
  let res: RespuestaFalsa;

  beforeAll(() => {
    for (const conjunto of CONJUNTOS) {
      obtenerDatosOriginales.set(
        conjunto,
        CATALOGO_EXPORTS[conjunto].obtenerDatos,
      );
    }
  });

  beforeEach(() => {
    prisma = {};
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new ExportsService(prisma, auditoria);
    res = new RespuestaFalsa();

    // Ningun test toca la base: cada conjunto devuelve vacio salvo que el
    // propio test lo sustituya.
    for (const conjunto of CONJUNTOS) {
      CATALOGO_EXPORTS[conjunto].obtenerDatos = jest
        .fn()
        .mockResolvedValue({ datos: [], total: 0 });
    }
  });

  afterAll(() => {
    for (const conjunto of CONJUNTOS) {
      CATALOGO_EXPORTS[conjunto].obtenerDatos =
        obtenerDatosOriginales.get(conjunto);
    }
  });

  const bodyVentas = {
    conjunto: 'ventas',
    formato: 'csv' as const,
    filtros: { desde: '2026-01-01', hasta: '2026-01-02' },
  };

  const usuarioCon = (id: string, permisos: string[]) => ({
    id,
    nombre: 'Usuario de prueba',
    rol: 'Gerente',
    sucursalId: 'sucursal-1',
    permisos,
  });

  it('exige usuarios.crear_editar', async () => {
    const user = usuarioCon('u-sin-permiso', ['ventas.ver']);

    await expect(
      service.exportSingle(res as any, user, bodyVentas),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('exige el permiso de lectura del conjunto', async () => {
    const user = usuarioCon('u-sin-reporte', ['usuarios.crear_editar']);

    await expect(
      service.exportSingle(res as any, user, {
        conjunto: 'reporte',
        formato: 'csv',
        filtros: { desde: '2026-01-01', hasta: '2026-01-02' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('rechaza un formato desconocido', async () => {
    const user = usuarioCon('u-formato', [
      'usuarios.crear_editar',
      'ventas.ver',
    ]);

    await expect(
      service.exportSingle(res as any, user, {
        ...bodyVentas,
        formato: 'pdf',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('exige un rango valido en los conjuntos de actividad', async () => {
    const user = usuarioCon('u-rango', [
      'usuarios.crear_editar',
      'ventas.ver',
    ]);

    await expect(
      service.exportSingle(res as any, user, {
        conjunto: 'ventas',
        formato: 'csv',
        filtros: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('registra exportacion_generada con metadatos y sin filas', async () => {
    const user = usuarioCon('u-exito', [
      'usuarios.crear_editar',
      'ventas.ver',
    ]);
    const marcadorDeFila = 'FILA-QUE-NO-DEBE-IR-AL-DETALLE';
    CATALOGO_EXPORTS.ventas.obtenerDatos = jest
      .fn()
      .mockResolvedValue({ datos: [{ Fecha: marcadorDeFila }], total: 1 });

    await service.exportSingle(res as any, user, bodyVentas);

    expect(auditoria.registrar).toHaveBeenCalledTimes(1);

    const evento = auditoria.registrar.mock.calls[0][0];
    expect(evento).toMatchObject({
      entidad: 'exportacion',
      accion: 'exportacion_generada',
      actorId: 'u-exito',
    });
    expect(evento.entidadId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(evento.detalle).toEqual({
      conjuntos: ['ventas'],
      formato: 'csv',
      filtros: { desde: '2026-01-01', hasta: '2026-01-02' },
      filasPorConjunto: { ventas: 1 },
    });
    expect(JSON.stringify(evento.detalle)).not.toContain(marcadorDeFila);
  });

  it('en el libro completo omite los conjuntos sin permiso de lectura', async () => {
    const user = usuarioCon('u-full', [
      'usuarios.crear_editar',
      'ventas.ver',
    ]);

    await service.exportFull(res as any, user);

    expect(auditoria.registrar).toHaveBeenCalledTimes(1);
    const evento = auditoria.registrar.mock.calls[0][0];
    expect(evento.accion).toBe('exportacion_generada');
    expect(evento.detalle.conjuntos).toEqual([
      'ventas',
      'usuarios',
      'auditoria',
    ]);

    expect(CATALOGO_EXPORTS.ventas.obtenerDatos).toHaveBeenCalledTimes(1);
    expect(CATALOGO_EXPORTS.usuarios.obtenerDatos).toHaveBeenCalledTimes(1);
    expect(CATALOGO_EXPORTS.auditoria.obtenerDatos).toHaveBeenCalledTimes(1);
    expect(CATALOGO_EXPORTS.reporte.obtenerDatos).not.toHaveBeenCalled();
    expect(CATALOGO_EXPORTS.empleados.obtenerDatos).not.toHaveBeenCalled();
  });

  it('aplica el tope de 20000 filas por conjunto y deja exportacion_fallida', async () => {
    const user = usuarioCon('u-tope', [
      'usuarios.crear_editar',
      'ventas.ver',
    ]);
    CATALOGO_EXPORTS.ventas.obtenerDatos = jest
      .fn()
      .mockResolvedValue({ datos: [], total: 20_001 });

    await expect(
      service.exportSingle(res as any, user, bodyVentas),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(auditoria.registrar).toHaveBeenCalledTimes(1);
    expect(auditoria.registrar.mock.calls[0][0]).toMatchObject({
      accion: 'exportacion_fallida',
      actorId: 'u-tope',
      detalle: { conjuntos: ['ventas'], formato: 'csv' },
    });
  });

  it('aplica el tope global de 50000 filas totales', async () => {
    const user = usuarioCon('u-tope-global', [
      'usuarios.crear_editar',
      'ventas.ver',
    ]);
    for (const conjunto of ['ventas', 'usuarios', 'auditoria']) {
      CATALOGO_EXPORTS[conjunto].obtenerDatos = jest
        .fn()
        .mockResolvedValue({ datos: [], total: 20_000 });
    }

    await expect(service.exportFull(res as any, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(auditoria.registrar).toHaveBeenCalledTimes(1);
    expect(auditoria.registrar.mock.calls[0][0].accion).toBe(
      'exportacion_fallida',
    );
  });

  it('limita a una exportacion concurrente por usuario y dos globales', async () => {
    const pendientes: Array<(valor: any) => void> = [];
    CATALOGO_EXPORTS.ventas.obtenerDatos = jest.fn(
      () =>
        new Promise((resolve) => {
          pendientes.push(resolve);
        }),
    );

    const user1 = usuarioCon('u-concurrente-1', [
      'usuarios.crear_editar',
      'ventas.ver',
    ]);
    const user2 = usuarioCon('u-concurrente-2', [
      'usuarios.crear_editar',
      'ventas.ver',
    ]);
    const user3 = usuarioCon('u-concurrente-3', [
      'usuarios.crear_editar',
      'ventas.ver',
    ]);

    const p1 = service
      .exportSingle(new RespuestaFalsa() as any, user1, bodyVentas)
      .catch((error) => error);
    const p2 = service
      .exportSingle(new RespuestaFalsa() as any, user2, bodyVentas)
      .catch((error) => error);

    // Ambas llegaron al await de obtenerDatos con su slot tomado.
    expect(pendientes).toHaveLength(2);

    const r3 = await service
      .exportSingle(new RespuestaFalsa() as any, user3, bodyVentas)
      .catch((error) => error);
    expect(r3).toBeInstanceOf(HttpException);
    expect((r3 as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );

    const r1b = await service
      .exportSingle(new RespuestaFalsa() as any, user1, bodyVentas)
      .catch((error) => error);
    expect(r1b).toBeInstanceOf(HttpException);
    expect((r1b as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );

    pendientes[0]({ datos: [], total: 0 });
    pendientes[1]({ datos: [], total: 0 });
    await Promise.allSettled([p1, p2]);

    const p1c = service
      .exportSingle(new RespuestaFalsa() as any, user1, bodyVentas)
      .catch((error) => error);
    expect(pendientes).toHaveLength(3);
    pendientes[2]({ datos: [], total: 0 });
    await p1c;
  });
});
