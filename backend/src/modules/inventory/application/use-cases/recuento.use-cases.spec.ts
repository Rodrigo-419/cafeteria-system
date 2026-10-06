import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

// El repositorio solo se usa como tipo, pero importarlo arrastraria Prisma y el
// cliente generado. Se sustituye el modulo para no tocar la base de datos.
jest.mock('../../infrastructure/inventory.repository', () => ({
  InventoryRepository: class InventoryRepository {},
}));

import { CrearRecuentoUseCase } from './crear-recuento.use-case';
import { ReevaluarAlertasService } from './reevaluar-alertas.service';
import type { InventoryRepository } from '../../infrastructure/inventory.repository';
import { ROL_ADMIN, ROL_GERENTE } from '../../../users/domain/roles';

/** Cliente de transaccion simulado; sirve para comprobar que se usa uno solo. */
const TRANSACCION = { marca: 'transaccion' };

const ADMIN = { id: 'admin-1', rol: ROL_ADMIN, sucursalId: null };
const GERENTE = { id: 'ger-1', rol: ROL_GERENTE, sucursalId: 'suc-1' };

type Repo = Record<string, jest.Mock>;

function repo(sobrescrituras: Record<string, unknown> = {}): Repo {
  const base: Repo = {
    enTransaccion: jest
      .fn()
      .mockImplementation(async (operacion: (cliente: unknown) => Promise<unknown>) =>
        operacion(TRANSACCION),
      ),
    existeSucursal: jest.fn().mockResolvedValue(true),
    contarInsumosPorIds: jest.fn().mockResolvedValue(0),
    bloquearStocks: jest.fn().mockImplementation(async (ids: string[]) => ids),
    buscarStocksPorIds: jest.fn().mockResolvedValue([]),
    fijarStock: jest.fn().mockResolvedValue(undefined),
    crearRecuento: jest.fn().mockImplementation(async (datos) => ({
      id: 'rec-1',
      sucursalId: datos.sucursalId,
      usuarioId: datos.usuarioId,
      createdAt: new Date(),
      detalles: datos.detalles,
    })),
    crearMovimientos: jest.fn().mockResolvedValue(undefined),
  };

  return Object.assign(base, sobrescrituras) as Repo;
}

/**
 * Fila de `insumo_sucursal` como la devuelve el repositorio.
 *
 * El repositorio entrega los decimales como texto con dos decimales, no como
 * `Decimal` de Prisma: el mock tiene que reflejar esa forma o la prueba estaria
 * comprobando un contrato que la API no cumple.
 */
function fila(insumoId: string, stockActual: string, estado = 'activo') {
  return {
    id: `is-${insumoId}`,
    insumoId,
    sucursalId: 'suc-9',
    nombre: 'Cafe molido',
    presentacion: 'paquete',
    stockActual,
    stockMinimo: '5.00',
    estado,
    insumo: { id: insumoId, nombre: 'Cafe molido', presentacion: 'paquete' },
  };
}

describe('CrearRecuentoUseCase', () => {
  let repository: Repo;
  let reevaluar: { ejecutar: jest.Mock };
  let useCase: CrearRecuentoUseCase;

  beforeEach(() => {
    repository = repo();
    reevaluar = { ejecutar: jest.fn().mockResolvedValue(undefined) };
    useCase = new CrearRecuentoUseCase(
      repository as unknown as InventoryRepository,
      reevaluar as unknown as ReevaluarAlertasService,
    );
  });

  /**
   * Deja el repositorio listo para un recuento de un solo insumo y devuelve el
   * cuerpo de la peticion.
   *
   * Se llama ANTES de sobreescribir un mock: si se llamara despues, volveria a
   * instalar los valores por defecto y el test pasaria sin ejercitar nada.
   */
  function preparado(stockSistema: string, fisico: number, estado = 'activo') {
    repository.contarInsumosPorIds.mockResolvedValue(1);
    repository.buscarStocksPorIds.mockResolvedValue([fila('ins-1', stockSistema, estado)]);

    return { items: [{ insumoId: 'ins-1', stockFisico: fisico }] };
  }

  it('exige acceso a la sucursal antes de abrir la transaccion', async () => {
    await expect(
      useCase.ejecutar(GERENTE, 'suc-2', { items: [{ insumoId: 'ins-1', stockFisico: 1 }] }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.enTransaccion).not.toHaveBeenCalled();
  });

  it('responde 404 si la sucursal no existe', async () => {
    const entrada = preparado('10.00', 12);
    repository.existeSucursal.mockResolvedValue(false);

    await expect(useCase.ejecutar(ADMIN, 'suc-9', entrada)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('responde 404 si un insumo no esta en el catalogo', async () => {
    const entrada = preparado('10.00', 12);
    repository.contarInsumosPorIds.mockResolvedValue(0);

    await expect(useCase.ejecutar(ADMIN, 'suc-9', entrada)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(repository.bloquearStocks).not.toHaveBeenCalled();
  });

  it('responde 404 si el insumo no esta dado de alta en la sucursal', async () => {
    const entrada = preparado('10.00', 12);
    repository.buscarStocksPorIds.mockResolvedValue([]);

    await expect(useCase.ejecutar(ADMIN, 'suc-9', entrada)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(repository.fijarStock).not.toHaveBeenCalled();
    expect(repository.crearRecuento).not.toHaveBeenCalled();
  });

  it('responde 409 si el insumo esta descontinuado en la sucursal', async () => {
    const entrada = preparado('10.00', 12, 'descontinuado');

    await expect(useCase.ejecutar(ADMIN, 'suc-9', entrada)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(repository.fijarStock).not.toHaveBeenCalled();
  });

  it('bloquea las filas ANTES de leerlas', async () => {
    const entrada = preparado('10.00', 12);
    const orden: string[] = [];
    repository.bloquearStocks.mockImplementation(async () => {
      orden.push('bloquear');
      return ['is-ins-1'];
    });
    repository.buscarStocksPorIds.mockImplementation(async () => {
      orden.push('leer');
      return [fila('ins-1', '10.00')];
    });

    await useCase.ejecutar(ADMIN, 'suc-9', entrada);

    // Sin el bloqueo explicito, dos recuentos a la vez leerian el mismo stock.
    expect(orden).toEqual(['bloquear', 'leer']);
  });

  it('bloquea por el id del catalogo, que es lo que quien cuenta conoce', async () => {
    const entrada = preparado('10.00', 12);

    await useCase.ejecutar(ADMIN, 'suc-9', entrada);

    expect(repository.bloquearStocks).toHaveBeenCalledWith(
      ['ins-1'],
      'suc-9',
      TRANSACCION,
    );
  });

  it('fija el stock al valor contado cuando sobra mercaderia', async () => {
    const { items } = preparado('10.00', 12);

    await useCase.ejecutar(ADMIN, 'suc-9', { items });

    expect(repository.fijarStock).toHaveBeenCalledWith('is-ins-1', '12.00', TRANSACCION);
  });

  it('guarda un movimiento de ajuste positivo cuando sobra', async () => {
    const { items } = preparado('10.00', 12);

    await useCase.ejecutar(ADMIN, 'suc-9', { items });

    expect(repository.crearMovimientos).toHaveBeenCalledWith(
      [
        {
          insumoSucursalId: 'is-ins-1',
          tipo: 'ajuste',
          cantidad: '2.00',
          usuarioId: 'admin-1',
          motivo: 'Ajuste por recuento fisico',
        },
      ],
      TRANSACCION,
    );
  });

  it('fija el stock a cero y guarda el ajuste negativo cuando falta', async () => {
    const { items } = preparado('10.00', 0);

    await useCase.ejecutar(ADMIN, 'suc-9', { items });

    expect(repository.fijarStock).toHaveBeenCalledWith('is-ins-1', '0.00', TRANSACCION);
    expect(repository.crearMovimientos).toHaveBeenCalledWith(
      [expect.objectContaining({ cantidad: '-10.00', tipo: 'ajuste' })],
      TRANSACCION,
    );
  });

  it('la diferencia es fisico menos sistema, no al reves', async () => {
    const { items } = preparado('8.00', 10);

    await useCase.ejecutar(ADMIN, 'suc-9', { items });

    expect(repository.crearRecuento).toHaveBeenCalledWith(
      expect.objectContaining({
        detalles: [
          expect.objectContaining({
            stockSistema: '8.00',
            stockFisico: '10.00',
            diferencia: '2.00',
          }),
        ],
      }),
      TRANSACCION,
    );
  });

  it('guarda la linea aunque cuadre, pero sin mover el stock', async () => {
    const { items } = preparado('10.00', 10);

    await useCase.ejecutar(ADMIN, 'suc-9', { items });

    expect(repository.fijarStock).not.toHaveBeenCalled();
    expect(repository.crearMovimientos).toHaveBeenCalledWith([], TRANSACCION);
    expect(repository.crearRecuento).toHaveBeenCalledWith(
      expect.objectContaining({
        detalles: [expect.objectContaining({ diferencia: '0.00' })],
      }),
      TRANSACCION,
    );
  });

  it('no reevalua alertas de una linea que no ha cambiado', async () => {
    const { items } = preparado('10.00', 10);

    await useCase.ejecutar(ADMIN, 'suc-9', { items });

    expect(reevaluar.ejecutar).not.toHaveBeenCalled();
  });

  it('reevalua la alerta de cada linea que si ha cambiado', async () => {
    const { items } = preparado('10.00', 12);

    await useCase.ejecutar(ADMIN, 'suc-9', { items });

    expect(reevaluar.ejecutar).toHaveBeenCalledWith('is-ins-1', TRANSACCION);
  });

  it('acepta un fisico de cero, que es "no queda ninguno"', async () => {
    const { items } = preparado('10.00', 0);

    await expect(useCase.ejecutar(ADMIN, 'suc-9', { items })).resolves.toBeDefined();
  });

  it('rechaza un fisico negativo antes de tocar la base', async () => {
    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', { items: [{ insumoId: 'ins-1', stockFisico: -1 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.enTransaccion).not.toHaveBeenCalled();
  });

  it('rechaza un fisico con mas de dos decimales', async () => {
    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', { items: [{ insumoId: 'ins-1', stockFisico: 1.005 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un recuento sin lineas', async () => {
    await expect(useCase.ejecutar(ADMIN, 'suc-9', { items: [] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza contar el mismo insumo dos veces', async () => {
    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', {
        items: [
          { insumoId: 'ins-1', stockFisico: 1 },
          { insumoId: 'ins-1', stockFisico: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.enTransaccion).not.toHaveBeenCalled();
  });

  it('rechaza una linea sin insumo', async () => {
    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', { items: [{ insumoId: '  ', stockFisico: 1 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acepta varias lineas distintas y guarda un movimiento por cada diferencia', async () => {
    repository.contarInsumosPorIds.mockResolvedValue(2);
    repository.buscarStocksPorIds.mockResolvedValue([
      fila('ins-1', '10.00'),
      fila('ins-2', '4.00'),
    ]);

    await useCase.ejecutar(ADMIN, 'suc-9', {
      items: [
        { insumoId: 'ins-1', stockFisico: 12 },
        { insumoId: 'ins-2', stockFisico: 4 },
      ],
    });

    // Solo la primera tiene diferencia: la segunda se cuenta pero no se mueve.
    expect(repository.crearMovimientos).toHaveBeenCalledWith(
      [expect.objectContaining({ insumoSucursalId: 'is-ins-1' })],
      TRANSACCION,
    );
    expect(reevaluar.ejecutar).toHaveBeenCalledTimes(1);
    expect(reevaluar.ejecutar).toHaveBeenCalledWith('is-ins-1', TRANSACCION);
  });

  it('no deja movimientos a medias si una linea falla a mitad', async () => {
    repository.contarInsumosPorIds.mockResolvedValue(2);
    repository.buscarStocksPorIds.mockResolvedValue([
      fila('ins-1', '10.00'),
      fila('ins-2', '4.00', 'descontinuado'),
    ]);

    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', {
        items: [
          { insumoId: 'ins-1', stockFisico: 12 },
          { insumoId: 'ins-2', stockFisico: 4 },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    // La primera linea ya habia escrito su stock. Que no llegue a insertarse nada
    // es lo que garantiza la transaccion: al fallar, todo lo anterior tambien
    // se deshace.
    expect(repository.crearMovimientos).not.toHaveBeenCalled();
    expect(repository.crearRecuento).not.toHaveBeenCalled();
  });
});

describe('ReevaluarAlertasService', () => {
  type RepoAlertas = Record<string, jest.Mock>;

  function repoAlertas(sobrescrituras: Record<string, unknown> = {}): RepoAlertas {
    const base: RepoAlertas = {
      buscarStockPorId: jest.fn().mockResolvedValue(null),
      alertaAbierta: jest.fn().mockResolvedValue(null),
      abrirAlerta: jest.fn().mockResolvedValue(1),
      resolverAlerta: jest.fn().mockResolvedValue(1),
    };

    return Object.assign(base, sobrescrituras) as RepoAlertas;
  }

  async function ejecutarCon(repository: RepoAlertas) {
    const service = new ReevaluarAlertasService(
      repository as unknown as InventoryRepository,
    );

    return service.ejecutar('is-1', TRANSACCION as never);
  }

  it('no hace nada si la fila ya no existe', async () => {
    const repository = repoAlertas();

    await ejecutarCon(repository);

    expect(repository.alertaAbierta).not.toHaveBeenCalled();
    expect(repository.abrirAlerta).not.toHaveBeenCalled();
  });

  it('abre alerta cuando el stock cae al minimo', async () => {
    const repository = repoAlertas({
      buscarStockPorId: jest
        .fn()
        .mockResolvedValue({ id: 'is-1', estado: 'activo', stockActual: '5.00', stockMinimo: '5.00' }),
    });

    await ejecutarCon(repository);

    expect(repository.abrirAlerta).toHaveBeenCalledWith('is-1', TRANSACCION);
    expect(repository.resolverAlerta).not.toHaveBeenCalled();
  });

  it('abre alerta cuando el stock queda por debajo del minimo', async () => {
    const repository = repoAlertas({
      buscarStockPorId: jest
        .fn()
        .mockResolvedValue({ id: 'is-1', estado: 'activo', stockActual: '1.00', stockMinimo: '5.00' }),
    });

    await ejecutarCon(repository);

    expect(repository.abrirAlerta).toHaveBeenCalledWith('is-1', TRANSACCION);
  });

  it('resuelve la alerta abierta cuando el stock sube por encima del minimo', async () => {
    const repository = repoAlertas({
      buscarStockPorId: jest
        .fn()
        .mockResolvedValue({ id: 'is-1', estado: 'activo', stockActual: '6.00', stockMinimo: '5.00' }),
      alertaAbierta: jest.fn().mockResolvedValue({ id: 'al-1' }),
    });

    await ejecutarCon(repository);

    expect(repository.resolverAlerta).toHaveBeenCalledWith('is-1', TRANSACCION);
    expect(repository.abrirAlerta).not.toHaveBeenCalled();
  });

  it('no abre alerta si el stock sigue por debajo pero ya habia una', async () => {
    const repository = repoAlertas({
      buscarStockPorId: jest
        .fn()
        .mockResolvedValue({ id: 'is-1', estado: 'activo', stockActual: '1.00', stockMinimo: '5.00' }),
      alertaAbierta: jest.fn().mockResolvedValue({ id: 'al-1' }),
    });

    await ejecutarCon(repository);

    expect(repository.abrirAlerta).not.toHaveBeenCalled();
    expect(repository.resolverAlerta).not.toHaveBeenCalled();
  });

  it('no hace nada con el stock por encima del minimo y sin alerta abierta', async () => {
    const repository = repoAlertas({
      buscarStockPorId: jest
        .fn()
        .mockResolvedValue({ id: 'is-1', estado: 'activo', stockActual: '6.00', stockMinimo: '5.00' }),
    });

    await ejecutarCon(repository);

    expect(repository.abrirAlerta).not.toHaveBeenCalled();
    expect(repository.resolverAlerta).not.toHaveBeenCalled();
  });

  it('resuelve la alerta si el insumo se descontinua', async () => {
    const repository = repoAlertas({
      buscarStockPorId: jest
        .fn()
        .mockResolvedValue({ id: 'is-1', estado: 'descontinuado', stockActual: '99.00', stockMinimo: '5.00' }),
      alertaAbierta: jest.fn().mockResolvedValue({ id: 'al-1' }),
    });

    await ejecutarCon(repository);

    expect(repository.resolverAlerta).toHaveBeenCalledWith('is-1', TRANSACCION);
  });

  it('no aborta la transaccion si ya habia una alerta abierta', async () => {
    // `abrirAlerta` va con `skipDuplicates`, asi que una carrera no lanza error:
    // en PostgreSQL, un P2002 atrapado en JavaScript abortaria la transaccion
    // entera y el COMMIT fallaria.
    const repository = repoAlertas({
      buscarStockPorId: jest
        .fn()
        .mockResolvedValue({ id: 'is-1', estado: 'activo', stockActual: '0.00', stockMinimo: '5.00' }),
      abrirAlerta: jest.fn().mockResolvedValue(0),
    });

    await expect(ejecutarCon(repository)).resolves.toBeUndefined();
  });
});
