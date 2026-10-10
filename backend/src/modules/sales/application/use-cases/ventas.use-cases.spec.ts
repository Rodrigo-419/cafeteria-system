import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

// El repositorio se sustituye por un doble para no tocar la base de datos. El
// modulo tambien exporta `TOTALES_VACIOS`, que el listado usa como valor por
// defecto, asi que el doble lo tiene que devolver tambien.
jest.mock('../../infrastructure/sales.repository', () => ({
  SalesRepository: class SalesRepository {},
  TOTALES_VACIOS: { total: '0.00', lineas: 0 },
}));

import { RegistrarVentaUseCase } from './registrar-venta.use-case';
import { AnularVentaUseCase } from './anular-venta.use-case';
import { ListarVentasUseCase } from './listar-ventas.use-case';
import { ObtenerVentaUseCase } from './obtener-venta.use-case';
import type {
  DetalleVentaFila,
  OfertaVenta,
  SalesRepository,
  VentaCompleta,
  VentaFila,
} from '../../infrastructure/sales.repository';
import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../../../users/domain/roles';
import type { ActorVentas } from '../../domain/rules/alcance-ventas';

const SUCURSAL = 'suc-norte';
const SUCURSAL_AJENA = 'suc-sur';

const GERENTE: ActorVentas = { id: 'ger-1', rol: ROL_GERENTE, sucursalId: SUCURSAL };
const ADMIN: ActorVentas = { id: 'adm-1', rol: ROL_ADMIN, sucursalId: null };
const EMPLEADO: ActorVentas = { id: 'emp-1', rol: ROL_EMPLEADO, sucursalId: SUCURSAL };

const OFERTA_A = 'of-a';
const OFERTA_B = 'of-b';

/** Cliente de transaccion simulado; sirve para comprobar que se usa uno solo. */
const TRANSACCION = { marca: 'transaccion' };

function transaccionQueEjecuta() {
  return jest
    .fn()
    .mockImplementation(async (operacion: (cliente: unknown) => Promise<unknown>) =>
      operacion(TRANSACCION),
    );
}

function oferta(sobrescrituras: Partial<OfertaVenta> = {}): OfertaVenta {
  return {
    id: OFERTA_A,
    productoId: 'prod-1',
    sucursalId: SUCURSAL,
    varianteId: 'var-1',
    precio: '12.50',
    estado: 'activo',
    producto: { id: 'prod-1', nombre: 'Cafe' },
    variante: { id: 'var-1', nombre: 'Chico' },
    ...sobrescrituras,
  };
}

function venta(sobrescrituras: Partial<VentaFila> = {}): VentaFila {
  return {
    id: 'venta-1',
    sucursalId: SUCURSAL,
    usuarioId: GERENTE.id,
    metodoPago: 'efectivo',
    estado: 'completada',
    fechaAnulacion: null,
    usuarioAnuladorId: null,
    motivoAnulacion: null,
    createdAt: new Date('2026-10-06T16:00:00Z'),
    updatedAt: new Date('2026-10-06T16:00:00Z'),
    sucursal: { id: SUCURSAL, nombre: 'Sucursal Norte' },
    vendedor: { id: GERENTE.id, nombre: 'Gerente' },
    anulador: null,
    ...sobrescrituras,
  };
}

function detalle(
  productoSucursalVarianteId: string,
  precioUnitario: string,
  subtotal: string,
  cantidad: number,
): DetalleVentaFila {
  return {
    id: `det-${productoSucursalVarianteId}`,
    productoSucursalVarianteId,
    cantidad,
    precioUnitario,
    subtotal,
    producto: { id: 'prod-1', nombre: 'Cafe' },
    variante: { id: 'var-1', nombre: 'Chico' },
  };
}

function ventaCompleta(
  sobrescriturasVenta: Partial<VentaFila> = {},
  detalles: DetalleVentaFila[] = [],
): VentaCompleta {
  return { venta: venta(sobrescriturasVenta), detalles };
}

type Repo = Record<string, jest.Mock>;

function repo(sobrescrituras: Record<string, unknown> = {}): Repo {
  const base: Repo = {
    enTransaccion: transaccionQueEjecuta(),
    existeSucursal: jest.fn().mockResolvedValue(true),
    buscarOfertas: jest.fn().mockResolvedValue([]),
    crearVenta: jest.fn().mockResolvedValue(venta()),
    crearDetalles: jest.fn().mockResolvedValue(0),
    detallesDeVenta: jest.fn().mockResolvedValue([]),
    buscarVentaCompleta: jest.fn().mockResolvedValue(null),
    anularVenta: jest.fn().mockResolvedValue(null),
    listarVentas: jest.fn().mockResolvedValue([]),
    contarVentas: jest.fn().mockResolvedValue(0),
    totalesDeVentas: jest.fn().mockResolvedValue(new Map()),
  };

  return Object.assign(base, sobrescrituras) as Repo;
}

function comoRepositorio(r: Repo): SalesRepository {
  return r as unknown as SalesRepository;
}

describe('RegistrarVentaUseCase', () => {
  it('exige sucursal y responde 403 sin tocar la base', async () => {
    const repository = repo();
    const useCase = new RegistrarVentaUseCase(comoRepositorio(repository));

    await expect(
      useCase.ejecutar(ADMIN, {
        metodoPago: 'efectivo',
        items: [{ productoSucursalVarianteId: OFERTA_A, cantidad: 1 }],
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.enTransaccion).not.toHaveBeenCalled();
  });

  it('rechaza unas lineas vacias antes de transaccionar', async () => {
    const repository = repo();
    const useCase = new RegistrarVentaUseCase(comoRepositorio(repository));

    await expect(
      useCase.ejecutar(GERENTE, { metodoPago: 'efectivo', items: [] }),
    ).rejects.toThrow(BadRequestException);

    expect(repository.enTransaccion).not.toHaveBeenCalled();
  });

  it('responde 404 si la oferta no existe', async () => {
    const repository = repo({ buscarOfertas: jest.fn().mockResolvedValue([]) });
    const useCase = new RegistrarVentaUseCase(comoRepositorio(repository));

    await expect(
      useCase.ejecutar(GERENTE, {
        metodoPago: 'efectivo',
        items: [{ productoSucursalVarianteId: OFERTA_A, cantidad: 1 }],
      }),
    ).rejects.toThrow('La oferta no existe');
  });

  it('responde 404 con el mismo mensaje si la oferta es de otra sucursal', async () => {
    // Un 403 o un mensaje distinto confirmarian que ese id existe en la carta
    // de otra sucursal.
    const repository = repo({
      buscarOfertas: jest.fn().mockResolvedValue([oferta({ sucursalId: SUCURSAL_AJENA })]),
    });
    const useCase = new RegistrarVentaUseCase(comoRepositorio(repository));

    await expect(
      useCase.ejecutar(GERENTE, {
        metodoPago: 'efectivo',
        items: [{ productoSucursalVarianteId: OFERTA_A, cantidad: 1 }],
      }),
    ).rejects.toThrow('La oferta no existe');
    expect(repository.crearVenta).not.toHaveBeenCalled();
  });

  it('responde 409 si la oferta esta inactiva', async () => {
    const repository = repo({
      buscarOfertas: jest.fn().mockResolvedValue([oferta({ estado: 'inactivo' })]),
    });
    const useCase = new RegistrarVentaUseCase(comoRepositorio(repository));

    await expect(
      useCase.ejecutar(GERENTE, {
        metodoPago: 'tarjeta',
        items: [{ productoSucursalVarianteId: OFERTA_A, cantidad: 1 }],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('congela el precio de la oferta y calcula el total en centimos exactos', async () => {
    const repository = repo({
      buscarOfertas: jest
        .fn()
        .mockResolvedValue([oferta({ precio: '0.10' }), oferta({ id: OFERTA_B, precio: '12.50' })]),
      detallesDeVenta: jest.fn().mockResolvedValue([
        detalle(OFERTA_A, '0.10', '0.30', 3),
        detalle(OFERTA_B, '12.50', '25.00', 2),
      ]),
    });
    const useCase = new RegistrarVentaUseCase(comoRepositorio(repository));

    const resultado = await useCase.ejecutar(GERENTE, {
      metodoPago: 'tarjeta',
      items: [
        { productoSucursalVarianteId: OFERTA_A, cantidad: 3 },
        { productoSucursalVarianteId: OFERTA_B, cantidad: 2 },
      ],
    });

    expect(repository.enTransaccion).toHaveBeenCalledTimes(1);

    expect(repository.crearVenta).toHaveBeenCalledWith(
      { sucursalId: SUCURSAL, usuarioId: GERENTE.id, metodoPago: 'tarjeta' },
      TRANSACCION,
    );

    // 0.10 x 3 = 0.30 exacto: con coma flotante saldria 0.30000000000000004.
    expect(repository.crearDetalles).toHaveBeenCalledWith(
      'venta-1',
      [
        {
          productoSucursalVarianteId: OFERTA_A,
          cantidad: 3,
          precioUnitarioSnapshot: '0.10',
          subtotal: '0.30',
        },
        {
          productoSucursalVarianteId: OFERTA_B,
          cantidad: 2,
          precioUnitarioSnapshot: '12.50',
          subtotal: '25.00',
        },
      ],
      TRANSACCION,
    );

    expect(resultado.total).toBe('25.30');
    expect(resultado.lineas).toBe(2);
    expect(resultado.estado).toBe('completada');
    expect(resultado.fecha).toBe('2026-10-06');
    expect(resultado.detalles).toHaveLength(2);
  });
});

describe('AnularVentaUseCase', () => {
  const AHORA = new Date('2026-10-06T18:00:00Z');

  it('exige motivo y no transaccion sin el', async () => {
    const repository = repo();
    const useCase = new AnularVentaUseCase(comoRepositorio(repository));

    await expect(useCase.ejecutar(GERENTE, 'venta-1', '   ', AHORA)).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.enTransaccion).not.toHaveBeenCalled();
  });

  it('responde 404 si la venta no existe o es de otra sucursal', async () => {
    const inexistente = repo();
    await expect(
      new AnularVentaUseCase(comoRepositorio(inexistente)).ejecutar(
        GERENTE,
        'venta-x',
        'Motivo',
        AHORA,
      ),
    ).rejects.toThrow(NotFoundException);

    const ajena = repo({
      buscarVentaCompleta: jest
        .fn()
        .mockResolvedValue(ventaCompleta({ sucursalId: SUCURSAL_AJENA })),
    });
    await expect(
      new AnularVentaUseCase(comoRepositorio(ajena)).ejecutar(
        GERENTE,
        'venta-1',
        'Motivo',
        AHORA,
      ),
    ).rejects.toThrow('La venta no existe');

    // La lectura si entra en la transaccion; la escritura no.
    expect(inexistente.buscarVentaCompleta).toHaveBeenCalledWith('venta-x', TRANSACCION);
    expect(inexistente.anularVenta).not.toHaveBeenCalled();
  });

  it('responde 409 si la venta ya esta anulada', async () => {
    const repository = repo({
      buscarVentaCompleta: jest.fn().mockResolvedValue(ventaCompleta({ estado: 'anulada' })),
    });
    const useCase = new AnularVentaUseCase(comoRepositorio(repository));

    await expect(useCase.ejecutar(GERENTE, 'venta-1', 'Motivo', AHORA)).rejects.toThrow(
      ConflictException,
    );
    expect(repository.anularVenta).not.toHaveBeenCalled();
  });

  it('responde 409 si la venta no es del mismo dia local', async () => {
    // 05/10 en Lima: 23:00 UTC del 5 es 18:00 del 5 en Lima, y ahora ya es el 6.
    const repository = repo({
      buscarVentaCompleta: jest.fn().mockResolvedValue(
        ventaCompleta({ createdAt: new Date('2026-10-05T23:00:00Z') }),
      ),
    });
    const useCase = new AnularVentaUseCase(comoRepositorio(repository));

    await expect(useCase.ejecutar(GERENTE, 'venta-1', 'Motivo', AHORA)).rejects.toThrow(
      'Solo se pueden anular ventas del mismo dia',
    );
    expect(repository.anularVenta).not.toHaveBeenCalled();
  });

  it('responde 403 si un Empleado intenta anular una venta que no registro', async () => {
    const repository = repo({
      buscarVentaCompleta: jest
        .fn()
        .mockResolvedValue(ventaCompleta({ usuarioId: GERENTE.id })),
    });
    const useCase = new AnularVentaUseCase(comoRepositorio(repository));

    await expect(
      useCase.ejecutar(EMPLEADO, 'venta-1', 'Motivo', AHORA),
    ).rejects.toThrow('No puedes anular una venta que no registraste');
    expect(repository.anularVenta).not.toHaveBeenCalled();
  });

  it('un Empleado anula la venta que el mismo registro', async () => {
    const anulada = venta({
      usuarioId: EMPLEADO.id,
      estado: 'anulada',
      fechaAnulacion: AHORA,
      usuarioAnuladorId: EMPLEADO.id,
      motivoAnulacion: 'Motivo',
    });

    const repository = repo({
      buscarVentaCompleta: jest
        .fn()
        .mockResolvedValue(ventaCompleta({ usuarioId: EMPLEADO.id })),
      anularVenta: jest.fn().mockResolvedValue(anulada),
    });
    const useCase = new AnularVentaUseCase(comoRepositorio(repository));

    const resultado = await useCase.ejecutar(EMPLEADO, 'venta-1', 'Motivo', AHORA);

    expect(repository.anularVenta).toHaveBeenCalledWith(
      'venta-1',
      {
        fechaAnulacion: AHORA,
        usuarioAnuladorId: EMPLEADO.id,
        motivoAnulacion: 'Motivo',
      },
      TRANSACCION,
    );
    expect(resultado.estado).toBe('anulada');
    expect(resultado.motivoAnulacion).toBe('Motivo');
  });

  it('anula dejando motivo, autor y hora, y devuelve la venta', async () => {
    const anulada = venta({
      estado: 'anulada',
      fechaAnulacion: AHORA,
      usuarioAnuladorId: GERENTE.id,
      motivoAnulacion: 'Se equivoco en el precio',
    });

    const repository = repo({
      buscarVentaCompleta: jest
        .fn()
        .mockResolvedValue(ventaCompleta({}, [detalle(OFERTA_A, '12.50', '12.50', 1)])),
      anularVenta: jest.fn().mockResolvedValue(anulada),
    });
    const useCase = new AnularVentaUseCase(comoRepositorio(repository));

    const resultado = await useCase.ejecutar(
      GERENTE,
      'venta-1',
      '  Se equivoco en el precio  ',
      AHORA,
    );

    expect(repository.anularVenta).toHaveBeenCalledWith(
      'venta-1',
      {
        fechaAnulacion: AHORA,
        usuarioAnuladorId: GERENTE.id,
        motivoAnulacion: 'Se equivoco en el precio',
      },
      TRANSACCION,
    );
    expect(resultado.estado).toBe('anulada');
    expect(resultado.motivoAnulacion).toBe('Se equivoco en el precio');
    expect(resultado.total).toBe('12.50');
  });

  it('responde 409 si otra peticion gano la carrera', async () => {
    const repository = repo({
      buscarVentaCompleta: jest.fn().mockResolvedValue(ventaCompleta()),
      anularVenta: jest.fn().mockResolvedValue(null),
    });
    const useCase = new AnularVentaUseCase(comoRepositorio(repository));

    await expect(useCase.ejecutar(GERENTE, 'venta-1', 'Motivo', AHORA)).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('ObtenerVentaUseCase', () => {
  it('devuelve la venta con sus lineas y su total', async () => {
    const repository = repo({
      buscarVentaCompleta: jest
        .fn()
        .mockResolvedValue(ventaCompleta({}, [detalle(OFERTA_A, '12.50', '25.00', 2)])),
    });
    const useCase = new ObtenerVentaUseCase(comoRepositorio(repository));

    const resultado = await useCase.ejecutar(GERENTE, 'venta-1');

    expect(repository.buscarVentaCompleta).toHaveBeenCalledWith('venta-1');
    expect(resultado.total).toBe('25.00');
    expect(resultado.lineas).toBe(1);
    expect(resultado.detalles[0].producto.nombre).toBe('Cafe');
  });

  it('responde 404 si no existe o es de otra sucursal', async () => {
    const inexistente = new ObtenerVentaUseCase(comoRepositorio(repo()));
    await expect(inexistente.ejecutar(GERENTE, 'venta-x')).rejects.toThrow(NotFoundException);

    const ajena = new ObtenerVentaUseCase(
      comoRepositorio(
        repo({
          buscarVentaCompleta: jest
            .fn()
            .mockResolvedValue(ventaCompleta({ sucursalId: SUCURSAL_AJENA })),
        }),
      ),
    );
    await expect(ajena.ejecutar(GERENTE, 'venta-1')).rejects.toThrow('La venta no existe');

    // El Admin si la ve: es central.
    const delAdmin = new ObtenerVentaUseCase(
      comoRepositorio(
        repo({
          buscarVentaCompleta: jest
            .fn()
            .mockResolvedValue(ventaCompleta({ sucursalId: SUCURSAL_AJENA })),
        }),
      ),
    );
    await expect(delAdmin.ejecutar(ADMIN, 'venta-1')).resolves.toMatchObject({
      id: 'venta-1',
    });
  });
});

describe('ListarVentasUseCase', () => {
  it('pagina y suma los totales de la pagina', async () => {
    const totales = new Map([
      ['venta-1', { total: '12.50', lineas: 1 }],
      ['venta-2', { total: '0.30', lineas: 3 }],
    ]);

    const repository = repo({
      listarVentas: jest.fn().mockResolvedValue([venta(), venta({ id: 'venta-2' })]),
      contarVentas: jest.fn().mockResolvedValue(7),
      totalesDeVentas: jest.fn().mockResolvedValue(totales),
    });
    const useCase = new ListarVentasUseCase(comoRepositorio(repository));

    const resultado = await useCase.ejecutar(ADMIN, { page: 2, limit: 2 });

    expect(resultado).toEqual({
      data: [
        expect.objectContaining({ id: 'venta-1', total: '12.50', lineas: 1 }),
        expect.objectContaining({ id: 'venta-2', total: '0.30', lineas: 3 }),
      ],
      total: 7,
      page: 2,
      limit: 2,
      totalPaginas: 4,
    });
    expect(repository.listarVentas).toHaveBeenCalledWith({}, 2, 2);
    expect(repository.totalesDeVentas).toHaveBeenCalledWith(['venta-1', 'venta-2']);
  });

  it('recorta al Gerente a su sucursal sin consultar', async () => {
    const repository = repo();
    const useCase = new ListarVentasUseCase(comoRepositorio(repository));

    await expect(
      useCase.ejecutar(GERENTE, { page: 1, limit: 20, sucursalId: SUCURSAL_AJENA }),
    ).rejects.toThrow(NotFoundException);

    expect(repository.listarVentas).not.toHaveBeenCalled();

    await useCase.ejecutar(GERENTE, { page: 1, limit: 20 });

    expect(repository.listarVentas).toHaveBeenCalledWith(
      { sucursalId: SUCURSAL },
      1,
      20,
    );
  });

  it('responde 404 si el Admin pide una sucursal que no existe', async () => {
    const repository = repo({ existeSucursal: jest.fn().mockResolvedValue(false) });
    const useCase = new ListarVentasUseCase(comoRepositorio(repository));

    await expect(
      useCase.ejecutar(ADMIN, { page: 1, limit: 20, sucursalId: 'suc-x' }),
    ).rejects.toThrow('La sucursal no existe');
    expect(repository.listarVentas).not.toHaveBeenCalled();
  });

  it('convierte el filtro de fecha en un rango UTC del dia local', async () => {
    const repository = repo();
    const useCase = new ListarVentasUseCase(comoRepositorio(repository));

    await useCase.ejecutar(ADMIN, { page: 1, limit: 20, fecha: '2026-10-06' });

    const filtros = repository.listarVentas.mock.calls[0][0] as {
      desde: Date;
      hasta: Date;
    };
    expect(filtros.desde.toISOString()).toBe('2026-10-06T05:00:00.000Z');
    expect(filtros.hasta.toISOString()).toBe('2026-10-07T05:00:00.000Z');
  });

  it('responde 400 con una fecha que no es un dia real', async () => {
    const repository = repo();
    const useCase = new ListarVentasUseCase(comoRepositorio(repository));

    await expect(
      useCase.ejecutar(ADMIN, { page: 1, limit: 20, fecha: '2026-02-30' }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.listarVentas).not.toHaveBeenCalled();
  });

  it('ignora un estado o un metodo de pago que no sea valido', async () => {
    const repository = repo();
    const useCase = new ListarVentasUseCase(comoRepositorio(repository));

    await useCase.ejecutar(ADMIN, {
      page: 1,
      limit: 20,
      estado: 'fantasma',
      metodoPago: 'bizum',
    });

    expect(repository.listarVentas).toHaveBeenCalledWith({}, 1, 20);
  });

  it('pasa los filtros validos al repositorio', async () => {
    const repository = repo();
    const useCase = new ListarVentasUseCase(comoRepositorio(repository));

    await useCase.ejecutar(ADMIN, {
      page: 1,
      limit: 10,
      estado: 'anulada',
      metodoPago: 'tarjeta',
      sucursalId: SUCURSAL,
    });

    expect(repository.listarVentas).toHaveBeenCalledWith(
      {
        sucursalId: SUCURSAL,
        estado: 'anulada',
        metodoPago: 'tarjeta',
      },
      1,
      10,
    );
  });
});
