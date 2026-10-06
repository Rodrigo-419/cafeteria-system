import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

// El repositorio solo se usa como tipo, pero importarlo arrastraria Prisma y el
// cliente generado. Se sustituye el modulo para no tocar la base de datos.
jest.mock('../../infrastructure/inventory.repository', () => ({
  InventoryRepository: class InventoryRepository {},
  esViolacionDeUnicidad: () => false,
}));

import {
  PRESENTACIONES_INSUMO,
  type PresentacionInsumo,
} from '../../domain/rules/presentacion-insumo';
import { CrearInsumoUseCase } from './crear-insumo.use-case';
import { EditarInsumoUseCase } from './editar-insumo.use-case';
import { EliminarInsumoUseCase } from './eliminar-insumo.use-case';
import type { InventoryRepository } from '../../infrastructure/inventory.repository';

type Repo = {
  enTransaccion: jest.Mock;
  bloquearNombreInsumo: jest.Mock;
  nombreInsumoEnUso: jest.Mock;
  crearInsumo: jest.Mock;
  buscarInsumoPorId: jest.Mock;
  actualizarInsumo: jest.Mock;
  contarSucursalesDeInsumo: jest.Mock;
  eliminarInsumo: jest.Mock;
};

/**
 * Cliente de transaccion simulado.
 *
 * Los casos de uso guardan el cliente en el mock para poder comprobar que todas
 * las consultas de una transaccion usan el MISMO. Sin esto, un caso que se
 * olvidara de pasar el cliente pasaria las pruebas igual.
 */
const TRANSACCION = { marca: 'transaccion' };

function repo(sobrescrituras: Partial<Record<keyof Repo, unknown>> = {}): Repo {
  const base: Repo = {
    // Reproduce el `PrismaService.$transaction`: ejecuta la operacion y le pasa
    // el cliente transaccional.
    enTransaccion: jest
      .fn()
      .mockImplementation(async (operacion: (cliente: unknown) => Promise<unknown>) =>
        operacion(TRANSACCION),
      ),
    bloquearNombreInsumo: jest.fn().mockResolvedValue(undefined),
    nombreInsumoEnUso: jest.fn().mockResolvedValue(false),
    crearInsumo: jest.fn().mockImplementation(async (data) => ({
      id: 'ins-nuevo',
      nombre: data.nombre,
      presentacion: data.presentacion ?? ('paquete' satisfies PresentacionInsumo),
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    buscarInsumoPorId: jest.fn().mockResolvedValue(null),
    actualizarInsumo: jest.fn().mockImplementation(async (_id, data) => ({
      id: 'ins-1',
      nombre: data.nombre ?? 'Cafe molido',
      presentacion: data.presentacion ?? ('paquete' satisfies PresentacionInsumo),
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    contarSucursalesDeInsumo: jest.fn().mockResolvedValue(0),
    eliminarInsumo: jest.fn().mockResolvedValue(undefined),
  };

  return Object.assign(base, sobrescrituras) as Repo;
}

const INSUMO_EXISTENTE = {
  id: 'ins-1',
  nombre: 'Cafe molido',
  presentacion: 'paquete' satisfies PresentacionInsumo,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CrearInsumoUseCase', () => {
  let repository: Repo;
  let useCase: CrearInsumoUseCase;

  beforeEach(() => {
    repository = repo();
    useCase = new CrearInsumoUseCase(
      repository as unknown as InventoryRepository,
    );
  });

it('crea el insumo con el nombre recortado', async () => {
    await useCase.ejecutar({ nombre: '  Cafe molido  ', presentacion: 'paquete' });

    expect(repository.crearInsumo).toHaveBeenCalledWith(
      { nombre: 'Cafe molido', presentacion: 'paquete' },
      TRANSACCION,
    );
  });

  it('toma el candado del nombre antes de comprobar el duplicado', async () => {
    const orden: string[] = [];
    repository.bloquearNombreInsumo.mockImplementation(async () => {
      orden.push('candado');
    });
    repository.nombreInsumoEnUso.mockImplementation(async () => {
      orden.push('comprobar');
      return false;
    });
    repository.crearInsumo.mockImplementation(async (data) => {
      orden.push('insertar');
      return {
        id: 'ins-nuevo',
        nombre: data.nombre,
        presentacion: data.presentacion,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    await useCase.ejecutar({ nombre: 'Leche', presentacion: 'bolsa' });

    // Si el `count` fuera antes del candado, dos altas simultaneas podrian leer
    // las dos que el nombre esta libre.
    expect(orden).toEqual(['candado', 'comprobar', 'insertar']);
  });

  it('comprueba el duplicado con el cliente de la transaccion', async () => {
    await useCase.ejecutar({ nombre: 'Leche', presentacion: 'bolsa' });

    expect(repository.bloquearNombreInsumo).toHaveBeenCalledWith(
      'Leche',
      TRANSACCION,
    );
    expect(repository.nombreInsumoEnUso).toHaveBeenCalledWith(
      'Leche',
      undefined,
      TRANSACCION,
    );
  });

  it('devuelve la fila que creo el repositorio', async () => {
    const resultado = await useCase.ejecutar({
      nombre: 'Leche',
      presentacion: 'bolsa',
    });

    expect(resultado.id).toBe('ins-nuevo');
  });

  it('rechaza un nombre duplicado con 409', async () => {
    repository.nombreInsumoEnUso.mockResolvedValue(true);

    await expect(
      useCase.ejecutar({ nombre: 'Leche', presentacion: 'bolsa' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('no comprueba duplicados si el nombre ya es invalido', async () => {
    await expect(
      useCase.ejecutar({ nombre: '  ', presentacion: 'bolsa' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.nombreInsumoEnUso).not.toHaveBeenCalled();
  });

  it('rechaza un nombre de un solo caracter', async () => {
    await expect(
      useCase.ejecutar({ nombre: 'L', presentacion: 'bolsa' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un nombre de mas de 100 caracteres', async () => {
    await expect(
      useCase.ejecutar({ nombre: 'L'.repeat(101), presentacion: 'bolsa' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acepta un nombre de exactamente 100 caracteres', async () => {
    const nombre = 'L'.repeat(100);

    await expect(
      useCase.ejecutar({ nombre, presentacion: 'bolsa' }),
    ).resolves.toBeDefined();
  });

  it('rechaza una presentacion inexistente con la lista de validas', async () => {
    await expect(
      useCase.ejecutar({ nombre: 'Leche', presentacion: 'litro' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      useCase.ejecutar({ nombre: 'Leche', presentacion: 'litro' }),
    ).rejects.toThrow(/paquete, bolsa, caja, unidad, paquete_varias_unidades/u);
  });

  it('acepta todas las presentaciones del enum', async () => {
    for (const presentacion of PRESENTACIONES_INSUMO) {
      await expect(
        useCase.ejecutar({ nombre: 'Leche', presentacion }),
      ).resolves.toBeDefined();
    }
  });

  it('no toca la base si el nombre es invalido', async () => {
    await expect(
      useCase.ejecutar({ nombre: 'x', presentacion: 'bolsa' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.crearInsumo).not.toHaveBeenCalled();
  });
});

describe('EditarInsumoUseCase', () => {
  let repository: Repo;
  let useCase: EditarInsumoUseCase;

  beforeEach(() => {
    repository = repo({
      buscarInsumoPorId: jest.fn().mockResolvedValue(INSUMO_EXISTENTE),
    });
    useCase = new EditarInsumoUseCase(
      repository as unknown as InventoryRepository,
    );
  });

  it('actualiza el nombre cuando cambia', async () => {
    await useCase.ejecutar('ins-1', { nombre: 'Cafe en grano' });

    expect(repository.actualizarInsumo).toHaveBeenCalledWith(
      'ins-1',
      { nombre: 'Cafe en grano' },
      TRANSACCION,
    );
  });

  it('toma el candado del nombre antes de comprobar el duplicado', async () => {
    const orden: string[] = [];
    repository.bloquearNombreInsumo.mockImplementation(async () => {
      orden.push('candado');
    });
    repository.nombreInsumoEnUso.mockImplementation(async () => {
      orden.push('comprobar');
      return false;
    });
    repository.actualizarInsumo.mockImplementation(async (id, data) => {
      orden.push('actualizar');
      return { id, nombre: 'Cafe en grano', ...data, createdAt: new Date(), updatedAt: new Date() };
    });

    await useCase.ejecutar('ins-1', { nombre: 'Cafe en grano' });

    expect(orden).toEqual(['candado', 'comprobar', 'actualizar']);
  });

  it('actualiza la presentacion sin abrir transaccion si el nombre no cambia', async () => {
    await useCase.ejecutar('ins-1', { presentacion: 'bolsa' });

    expect(repository.enTransaccion).not.toHaveBeenCalled();
    expect(repository.bloquearNombreInsumo).not.toHaveBeenCalled();
    expect(repository.actualizarInsumo).toHaveBeenCalledWith(
      'ins-1',
      { presentacion: 'bolsa' satisfies PresentacionInsumo },
    );
  });

  it('actualiza los dos campos juntos en una sola transaccion', async () => {
    await useCase.ejecutar('ins-1', { nombre: 'Cafe', presentacion: 'caja' });

    expect(repository.enTransaccion).toHaveBeenCalledTimes(1);
    expect(repository.actualizarInsumo).toHaveBeenCalledWith(
      'ins-1',
      { nombre: 'Cafe', presentacion: 'caja' satisfies PresentacionInsumo },
      TRANSACCION,
    );
  });

  it('responde 404 si el insumo no existe', async () => {
    repository.buscarInsumoPorId.mockResolvedValue(null);

    await expect(useCase.ejecutar('ins-x', { nombre: 'Cafe' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza un nombre duplicado con 409', async () => {
    repository.nombreInsumoEnUso.mockResolvedValue(true);

    await expect(useCase.ejecutar('ins-1', { nombre: 'Leche' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('comprueba el duplicado excluyendo el propio insumo', async () => {
    await useCase.ejecutar('ins-1', { nombre: 'Leche' });

    expect(repository.nombreInsumoEnUso).toHaveBeenCalledWith(
      'Leche',
      'ins-1',
      TRANSACCION,
    );
  });

  it('no escribe si el nombre es identico al actual, solo con espacios de mas', async () => {
    const resultado = await useCase.ejecutar('ins-1', { nombre: '  Cafe molido  ' });

    expect(repository.actualizarInsumo).not.toHaveBeenCalled();
    expect(resultado).toBe(INSUMO_EXISTENTE);
  });

  it('no escribe si la presentacion no cambia', async () => {
    const resultado = await useCase.ejecutar('ins-1', { presentacion: 'paquete' });

    expect(repository.actualizarInsumo).not.toHaveBeenCalled();
    expect(resultado).toBe(INSUMO_EXISTENTE);
  });

  it('no comprueba duplicados si el nombre no cambia', async () => {
    await useCase.ejecutar('ins-1', { nombre: 'Cafe molido' });

    expect(repository.nombreInsumoEnUso).not.toHaveBeenCalled();
  });

  it('no escribe nada si el cuerpo va vacio', async () => {
    const resultado = await useCase.ejecutar('ins-1', {});

    expect(repository.actualizarInsumo).not.toHaveBeenCalled();
    expect(resultado).toBe(INSUMO_EXISTENTE);
  });

  it('valida la longitud del nombre antes de tocar la base', async () => {
    await expect(useCase.ejecutar('ins-1', { nombre: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(repository.actualizarInsumo).not.toHaveBeenCalled();
  });

  it('valida la presentacion antes de tocar la base', async () => {
    await expect(
      useCase.ejecutar('ins-1', { presentacion: 'litro' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.actualizarInsumo).not.toHaveBeenCalled();
  });
});

describe('EliminarInsumoUseCase', () => {
  let repository: Repo;
  let useCase: EliminarInsumoUseCase;

  beforeEach(() => {
    repository = repo({
      buscarInsumoPorId: jest.fn().mockResolvedValue(INSUMO_EXISTENTE),
    });
    useCase = new EliminarInsumoUseCase(
      repository as unknown as InventoryRepository,
    );
  });

  it('borra un insumo que no tiene stock en ninguna sucursal', async () => {
    await useCase.ejecutar('ins-1');

    expect(repository.eliminarInsumo).toHaveBeenCalledWith('ins-1');
  });

  it('responde 409 si el insumo ya tiene stock en alguna sucursal', async () => {
    repository.contarSucursalesDeInsumo.mockResolvedValue(1);

    await expect(useCase.ejecutar('ins-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('no borra un insumo que esta en uso, y lo dice', async () => {
    repository.contarSucursalesDeInsumo.mockResolvedValue(3);

    await expect(useCase.ejecutar('ins-1')).rejects.toThrow(/descontinualo/u);
    expect(repository.eliminarInsumo).not.toHaveBeenCalled();
  });

  it('responde 404 si el insumo no existe', async () => {
    repository.buscarInsumoPorId.mockResolvedValue(null);

    await expect(useCase.ejecutar('ins-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('no mira el stock si el insumo no existe', async () => {
    repository.buscarInsumoPorId.mockResolvedValue(null);

    await expect(useCase.ejecutar('ins-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(repository.contarSucursalesDeInsumo).not.toHaveBeenCalled();
  });
});
