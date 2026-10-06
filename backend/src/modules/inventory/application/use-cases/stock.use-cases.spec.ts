import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

// El repositorio solo se usa como tipo, pero importarlo arrastraria Prisma y el
// cliente generado. Se sustituye el modulo para no tocar la base de datos.
jest.mock('../../infrastructure/inventory.repository', () => ({
  InventoryRepository: class InventoryRepository {},
}));

import { ListarStockUseCase } from './listar-stock.use-case';
import { ListarMovimientosUseCase } from './listar-movimientos.use-case';
import { ListarAlertasUseCase } from './listar-alertas.use-case';
import { ListarRecuentosUseCase, ObtenerRecuentoUseCase } from './listar-recuentos.use-case';
import { RegistrarEntradaUseCase } from './registrar-entrada.use-case';
import { ConfigurarStockUseCase } from './configurar-stock.use-case';
import { ReevaluarAlertasService } from './reevaluar-alertas.service';
import type { InventoryRepository } from '../../infrastructure/inventory.repository';
import { ROL_ADMIN, ROL_GERENTE } from '../../../users/domain/roles';

/** Cliente de transaccion simulado; sirve para comprobar que se usa uno solo. */
const TRANSACCION = { marca: 'transaccion' };

const ADMIN = { id: 'admin-1', rol: ROL_ADMIN, sucursalId: null };
const GERENTE = { id: 'ger-1', rol: ROL_GERENTE, sucursalId: 'suc-1' };

function transaccionQueEjecuta() {
  return jest
    .fn()
    .mockImplementation(async (operacion: (cliente: unknown) => Promise<unknown>) =>
      operacion(TRANSACCION),
    );
}

type Repo = Record<string, jest.Mock>;

function repo(sobrescrituras: Record<string, unknown> = {}): Repo {
  const base: Repo = {
    enTransaccion: transaccionQueEjecuta(),
    existeSucursal: jest.fn().mockResolvedValue(true),
    existeInsumo: jest.fn().mockResolvedValue(true),
    buscarStock: jest.fn().mockResolvedValue(null),
    buscarStockPorId: jest.fn().mockResolvedValue(null),
    configurarStock: jest.fn().mockImplementation(async (_insumoId, _sucursalId, datos) => ({
      id: 'is-1',
      nombre: 'Cafe molido',
      presentacion: 'paquete',
      stockActual: '10.00',
      stockMinimo: datos.stockMinimo ?? '5.00',
      estado: datos.estado ?? 'activo',
    })),
    incrementarStock: jest.fn().mockResolvedValue({
      id: 'is-1',
      nombre: 'Cafe molido',
      presentacion: 'paquete',
      stockActual: '13.00',
      stockMinimo: '5.00',
      estado: 'activo',
    }),
    crearMovimiento: jest.fn().mockImplementation(async (datos) => ({
      id: 'mov-1',
      ...datos,
      createdAt: new Date(),
    })),
    listarStock: jest.fn().mockResolvedValue([]),
    contarStock: jest.fn().mockResolvedValue(0),
    listarMovimientos: jest.fn().mockResolvedValue([]),
    contarMovimientos: jest.fn().mockResolvedValue(0),
    listarAlertas: jest.fn().mockResolvedValue([]),
    contarAlertas: jest.fn().mockResolvedValue(0),
    listarRecuentos: jest.fn().mockResolvedValue([]),
    contarRecuentos: jest.fn().mockResolvedValue(0),
    buscarRecuentoPorId: jest.fn().mockResolvedValue(null),
  };

  return Object.assign(base, sobrescrituras) as Repo;
}

describe('ListarStockUseCase', () => {
  let repository: Repo;
  let useCase: ListarStockUseCase;

  beforeEach(() => {
    repository = repo();
    useCase = new ListarStockUseCase(repository as unknown as InventoryRepository);
  });

  const entrada = { page: 1, limit: 20 };

  it('exige acceso a la sucursal antes de consultar nada', async () => {
    await expect(
      useCase.ejecutar(GERENTE, 'suc-2', entrada),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.listarStock).not.toHaveBeenCalled();
    expect(repository.existeSucursal).not.toHaveBeenCalled();
  });

  it('responde 404 si la sucursal no existe', async () => {
    repository.existeSucursal.mockResolvedValue(false);

    await expect(useCase.ejecutar(ADMIN, 'suc-9', entrada)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('el Admin puede ver cualquier sucursal existente', async () => {
    repository.listarStock.mockResolvedValue([{ id: 'is-1' }]);
    repository.contarStock.mockResolvedValue(1);

    const resultado = await useCase.ejecutar(ADMIN, 'suc-9', entrada);

    expect(resultado.data).toHaveLength(1);
    expect(resultado.total).toBe(1);
    expect(resultado.totalPaginas).toBe(1);
  });

  it('devuelve el sobre de paginado que usa el resto de la API', async () => {
    repository.contarStock.mockResolvedValue(45);

    const resultado = await useCase.ejecutar(ADMIN, 'suc-9', { page: 2, limit: 20 });

    expect(Object.keys(resultado).sort()).toEqual([
      'data',
      'limit',
      'page',
      'total',
      'totalPaginas',
    ]);
    expect(resultado.totalPaginas).toBe(3);
    expect(resultado.page).toBe(2);
    expect(resultado.limit).toBe(20);
  });

  it('filtra por la sucursal pedida y por el bajo minimo', async () => {
    await useCase.ejecutar(ADMIN, 'suc-9', { ...entrada, soloBajoMinimo: true });

    expect(repository.listarStock).toHaveBeenCalledWith(
      expect.objectContaining({ sucursalId: 'suc-9', soloBajoMinimo: true }),
    );
    expect(repository.contarStock).toHaveBeenCalledWith(
      expect.objectContaining({ sucursalId: 'suc-9', soloBajoMinimo: true }),
    );
  });

  it('ignora un estado que no es valido en vez de filtrar por algo imposible', async () => {
    await useCase.ejecutar(ADMIN, 'suc-9', { ...entrada, estado: 'inventado' });

    expect(repository.listarStock).toHaveBeenCalledWith(
      expect.not.objectContaining({ estado: expect.anything() }),
    );
  });

  it('deja pasar un estado valido', async () => {
    await useCase.ejecutar(ADMIN, 'suc-9', { ...entrada, estado: 'descontinuado' });

    expect(repository.listarStock).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'descontinuado' }),
    );
  });

  it('recorta la busqueda y descarta la vacia', async () => {
    await useCase.ejecutar(ADMIN, 'suc-9', { ...entrada, busqueda: '  cafe  ' });
    expect(repository.listarStock).toHaveBeenLastCalledWith(
      expect.objectContaining({ busqueda: 'cafe' }),
    );

    await useCase.ejecutar(ADMIN, 'suc-9', { ...entrada, busqueda: '' });
    expect(repository.listarStock).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ busqueda: expect.anything() }),
    );
  });
});

describe('ListarMovimientosUseCase', () => {
  let repository: Repo;
  let useCase: ListarMovimientosUseCase;

  beforeEach(() => {
    repository = repo();
    useCase = new ListarMovimientosUseCase(repository as unknown as InventoryRepository);
  });

  const entrada = { page: 1, limit: 20 };

  it('exige acceso a la sucursal antes de consultar nada', async () => {
    await expect(
      useCase.ejecutar(GERENTE, 'suc-2', entrada),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.listarMovimientos).not.toHaveBeenCalled();
  });

  it('responde 404 si la sucursal no existe', async () => {
    repository.existeSucursal.mockResolvedValue(false);

    await expect(useCase.ejecutar(ADMIN, 'suc-9', entrada)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('traduce el insumo del catalogo a la fila de stock de esa sucursal', async () => {
    repository.buscarStock.mockResolvedValue({ id: 'is-7', estado: 'activo' });

    await useCase.ejecutar(ADMIN, 'suc-9', { ...entrada, insumoId: 'ins-7' });

    expect(repository.buscarStock).toHaveBeenCalledWith('ins-7', 'suc-9');
    expect(repository.listarMovimientos).toHaveBeenCalledWith(
      expect.objectContaining({ insumoSucursalId: 'is-7', sucursalId: 'suc-9' }),
    );
  });

  it('responde 404 si el insumo no esta en esa sucursal', async () => {
    repository.buscarStock.mockResolvedValue(null);

    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', { ...entrada, insumoId: 'ins-7' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.listarMovimientos).not.toHaveBeenCalled();
  });

  it('no busca fila si no viene filtro de insumo', async () => {
    await useCase.ejecutar(ADMIN, 'suc-9', entrada);

    expect(repository.buscarStock).not.toHaveBeenCalled();
  });

  it('ignora un tipo que no es valido', async () => {
    await useCase.ejecutar(ADMIN, 'suc-9', { ...entrada, tipo: 'borrado' });

    expect(repository.listarMovimientos).toHaveBeenCalledWith(
      expect.not.objectContaining({ tipo: expect.anything() }),
    );
  });

  it('deja pasar los tipos validos', async () => {
    await useCase.ejecutar(ADMIN, 'suc-9', { ...entrada, tipo: 'ajuste' });

    expect(repository.listarMovimientos).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'ajuste' }),
    );
  });
});

describe('ListarAlertasUseCase', () => {
  let repository: Repo;
  let useCase: ListarAlertasUseCase;

  beforeEach(() => {
    repository = repo();
    useCase = new ListarAlertasUseCase(repository as unknown as InventoryRepository);
  });

  const entrada = { page: 1, limit: 20 };

  it('el Gerente queda atado a su sucursal aunque no la pida', async () => {
    await useCase.ejecutar(GERENTE, entrada);

    expect(repository.listarAlertas).toHaveBeenCalledWith(
      expect.objectContaining({ sucursalId: 'suc-1' }),
    );
  });

  it('responde 404 si el Gerente pide otra sucursal', async () => {
    await expect(
      useCase.ejecutar(GERENTE, { ...entrada, sucursalId: 'suc-2' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.listarAlertas).not.toHaveBeenCalled();
  });

  it('el Admin sin filtro de sucursal ve todas', async () => {
    await useCase.ejecutar(ADMIN, entrada);

    expect(repository.listarAlertas).toHaveBeenCalledWith(
      expect.not.objectContaining({ sucursalId: expect.anything() }),
    );
    expect(repository.existeSucursal).not.toHaveBeenCalled();
  });

  it('responde 404 si el Admin pide una sucursal que no existe', async () => {
    repository.existeSucursal.mockResolvedValue(false);

    await expect(
      useCase.ejecutar(ADMIN, { ...entrada, sucursalId: 'suc-9' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ignora un estado que no es valido', async () => {
    await useCase.ejecutar(ADMIN, { ...entrada, estado: 'pendiente' });

    expect(repository.listarAlertas).toHaveBeenCalledWith(
      expect.not.objectContaining({ estado: expect.anything() }),
    );
  });

  it('deja pasar un estado valido', async () => {
    await useCase.ejecutar(ADMIN, { ...entrada, estado: 'abierta' });

    expect(repository.listarAlertas).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'abierta' }),
    );
  });
});

describe('ListarRecuentosUseCase', () => {
  let repository: Repo;
  let useCase: ListarRecuentosUseCase;

  beforeEach(() => {
    repository = repo();
    useCase = new ListarRecuentosUseCase(repository as unknown as InventoryRepository);
  });

  it('el Gerente ve solo los de su sucursal', async () => {
    await useCase.ejecutar(GERENTE, { page: 1, limit: 20 });

    expect(repository.listarRecuentos).toHaveBeenCalledWith(
      expect.objectContaining({ sucursalId: 'suc-1' }),
    );
  });

  it('responde 404 si el Admin pide una sucursal que no existe', async () => {
    repository.existeSucursal.mockResolvedValue(false);

    await expect(
      useCase.ejecutar(ADMIN, { page: 1, limit: 20, sucursalId: 'suc-9' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('el Admin sin filtro ve todos los recuentos', async () => {
    await useCase.ejecutar(ADMIN, { page: 1, limit: 20 });

    expect(repository.listarRecuentos).toHaveBeenCalledWith(
      expect.not.objectContaining({ sucursalId: expect.anything() }),
    );
  });
});

describe('ObtenerRecuentoUseCase', () => {
  let repository: Repo;
  let useCase: ObtenerRecuentoUseCase;

  beforeEach(() => {
    repository = repo();
    useCase = new ObtenerRecuentoUseCase(repository as unknown as InventoryRepository);
  });

  it('responde 404 si el recuento no existe', async () => {
    await expect(useCase.ejecutar(ADMIN, 'rec-9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('el Gerente no puede leer el detalle de un recuento de otra sucursal', async () => {
    repository.buscarRecuentoPorId.mockResolvedValue({
      id: 'rec-1',
      sucursalId: 'suc-2',
      detalles: [],
    });

    await expect(useCase.ejecutar(GERENTE, 'rec-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('devuelve el recuento con sus lineas si es de su sucursal', async () => {
    repository.buscarRecuentoPorId.mockResolvedValue({
      id: 'rec-1',
      sucursalId: 'suc-1',
      detalles: [{ insumoSucursalId: 'is-1' }],
    });

    const resultado = await useCase.ejecutar(GERENTE, 'rec-1');

    expect(resultado.id).toBe('rec-1');
    expect(resultado.detalles).toHaveLength(1);
  });
});

describe('RegistrarEntradaUseCase', () => {
  let repository: Repo;
  let reevaluar: { ejecutar: jest.Mock };
  let useCase: RegistrarEntradaUseCase;

  beforeEach(() => {
    repository = repo();
    reevaluar = { ejecutar: jest.fn().mockResolvedValue(undefined) };
    useCase = new RegistrarEntradaUseCase(
      repository as unknown as InventoryRepository,
      reevaluar as unknown as ReevaluarAlertasService,
    );
  });

  const FILA = {
    id: 'is-1',
    nombre: 'Cafe molido',
    presentacion: 'paquete',
    stockActual: '8.00',
    stockMinimo: '5.00',
    estado: 'activo' as const,
  };

  it('exige acceso a la sucursal antes de tocar la base', async () => {
    await expect(
      useCase.ejecutar(GERENTE, 'suc-2', 'ins-1', { cantidad: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.enTransaccion).not.toHaveBeenCalled();
  });

  it('responde 404 si el insumo no esta dado de alta en la sucursal', async () => {
    repository.buscarStock.mockResolvedValue(null);

    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { cantidad: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.incrementarStock).not.toHaveBeenCalled();
  });

  it('responde 409 si el insumo esta descontinuado en la sucursal', async () => {
    repository.buscarStock.mockResolvedValue({ ...FILA, estado: 'descontinuado' });

    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { cantidad: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repository.incrementarStock).not.toHaveBeenCalled();
  });

  it('suma la cantidad y guarda el movimiento con el usuario que la hizo', async () => {
    repository.buscarStock.mockResolvedValue(FILA);

    const resultado = await useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', {
      cantidad: 5,
      motivo: 'Compra del lunes',
    });

    expect(repository.incrementarStock).toHaveBeenCalledWith('is-1', '5.00', TRANSACCION);
    expect(repository.crearMovimiento).toHaveBeenCalledWith(
      {
        insumoSucursalId: 'is-1',
        tipo: 'entrada',
        cantidad: '5.00',
        usuarioId: 'admin-1',
        motivo: 'Compra del lunes',
      },
      TRANSACCION,
    );
    expect(resultado.stock.stockActual).toBe('13.00');
  });

  it('guarda un motivo por defecto si no viene ninguno', async () => {
    repository.buscarStock.mockResolvedValue(FILA);

    await useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { cantidad: 5 });

    expect(repository.crearMovimiento).toHaveBeenCalledWith(
      expect.objectContaining({ motivo: 'Entrada de inventario' }),
      TRANSACCION,
    );
  });

  it('reevalua la alerta con el cliente de la misma transaccion', async () => {
    repository.buscarStock.mockResolvedValue(FILA);

    await useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { cantidad: 5 });

    expect(reevaluar.ejecutar).toHaveBeenCalledWith('is-1', TRANSACCION);
  });

  it('rechaza una cantidad de cero', async () => {
    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { cantidad: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.enTransaccion).not.toHaveBeenCalled();
  });

  it('rechaza una cantidad negativa', async () => {
    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { cantidad: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza mas de dos decimales', async () => {
    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { cantidad: 1.005 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza una cantidad por encima del maximo de la columna', async () => {
    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { cantidad: 1e11 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acepta un entero con decimales de relleno', async () => {
    repository.buscarStock.mockResolvedValue(FILA);

    await useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { cantidad: 12 });

    expect(repository.incrementarStock).toHaveBeenCalledWith('is-1', '12.00', TRANSACCION);
  });
});

describe('ConfigurarStockUseCase', () => {
  let repository: Repo;
  let reevaluar: { ejecutar: jest.Mock };
  let useCase: ConfigurarStockUseCase;

  beforeEach(() => {
    repository = repo();
    reevaluar = { ejecutar: jest.fn().mockResolvedValue(undefined) };
    useCase = new ConfigurarStockUseCase(
      repository as unknown as InventoryRepository,
      reevaluar as unknown as ReevaluarAlertasService,
    );
  });

  it('exige acceso a la sucursal antes de tocar la base', async () => {
    await expect(
      useCase.ejecutar(GERENTE, 'suc-2', 'ins-1', { stockMinimo: 3 }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.enTransaccion).not.toHaveBeenCalled();
  });

  it('responde 404 si la sucursal no existe', async () => {
    repository.existeSucursal.mockResolvedValue(false);

    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { stockMinimo: 3 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('responde 404 si el insumo no existe', async () => {
    repository.existeInsumo.mockResolvedValue(false);

    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { stockMinimo: 3 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('da de alta el insumo en la sucursal si no estaba', async () => {
    await useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { stockMinimo: 4 });

    expect(repository.configurarStock).toHaveBeenCalledWith(
      'ins-1',
      'suc-9',
      { stockMinimo: '4.00' },
      TRANSACCION,
    );
  });

  it('no manda el minimo si el cuerpo no lo trae, para no borrarlo', async () => {
    await useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { estado: 'descontinuado' });

    expect(repository.configurarStock).toHaveBeenCalledWith(
      'ins-1',
      'suc-9',
      { estado: 'descontinuado' },
      TRANSACCION,
    );
  });

  it('acepta un minimo de cero', async () => {
    await useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { stockMinimo: 0 });

    expect(repository.configurarStock).toHaveBeenCalledWith(
      'ins-1',
      'suc-9',
      { stockMinimo: '0.00' },
      TRANSACCION,
    );
  });

  it('rechaza un minimo negativo', async () => {
    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { stockMinimo: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un estado que no existe', async () => {
    await expect(
      useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { estado: 'inventado' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige que el cuerpo diga algo', async () => {
    await expect(useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(repository.configurarStock).not.toHaveBeenCalled();
  });

  it('reevalua la alerta tras cambiar el minimo', async () => {
    await useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { stockMinimo: 9 });

    expect(reevaluar.ejecutar).toHaveBeenCalledWith('is-1', TRANSACCION);
  });

  it('no toca el stock ni genera movimientos al configurar', async () => {
    await useCase.ejecutar(ADMIN, 'suc-9', 'ins-1', { stockMinimo: 9 });

    expect(repository.incrementarStock).not.toHaveBeenCalled();
    expect(repository.crearMovimiento).not.toHaveBeenCalled();
  });
});
