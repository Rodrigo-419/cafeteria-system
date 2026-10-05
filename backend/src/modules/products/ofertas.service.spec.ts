import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('./products.repository', () => ({
  ProductsRepository: class ProductsRepository {},
}));

import { ESTADO_POR_DEFECTO, OfertasService } from './ofertas.service';
import type { ActorProductos } from './products.rules';
import type {
  CartaFila,
  OfertaRespuesta,
  ProductsRepository,
} from './products.repository';
import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../users/domain/roles';

type Repo = {
  existeSucursal: jest.Mock;
  listarCarta: jest.Mock;
  upsertOferta: jest.Mock;
  existeProducto: jest.Mock;
  existeVariante: jest.Mock;
};

const SUC_NORTE = 'suc-norte';
const SUC_SUR = 'suc-sur';
const PROD_CAFE = 'prod-cafe';
const VAR_UNICA = 'var-unica';

const admin: ActorProductos = { id: 'adm-1', rol: ROL_ADMIN, sucursalId: null };
const gerente: ActorProductos = {
  id: 'ger-1',
  rol: ROL_GERENTE,
  sucursalId: SUC_NORTE,
};
const empleado: ActorProductos = {
  id: 'emp-1',
  rol: ROL_EMPLEADO,
  sucursalId: SUC_NORTE,
};

function fila(over: Partial<CartaFila> = {}): CartaFila {
  return {
    id: 'oferta-1',
    productoId: PROD_CAFE,
    varianteId: VAR_UNICA,
    precio: '2.50',
    estado: 'activo',
    producto: {
      id: PROD_CAFE,
      nombre: 'Cafe',
      categoriaId: 'cat-bebidas',
      categoria: { id: 'cat-bebidas', nombre: 'Bebidas' },
    },
    variante: { id: VAR_UNICA, nombre: 'Única' },
    ...over,
  };
}

describe('OfertasService', () => {
  let repo: Repo;
  let service: OfertasService;

  beforeEach(() => {
    repo = {
      existeSucursal: jest.fn().mockResolvedValue(true),
      listarCarta: jest.fn().mockResolvedValue([fila()]),
      upsertOferta: jest.fn().mockResolvedValue({ precio: '2.50', estado: 'activo' }),
      existeProducto: jest.fn().mockResolvedValue(true),
      existeVariante: jest.fn().mockResolvedValue(true),
    };

    service = new OfertasService(repo as unknown as ProductsRepository);
  });

  describe('carta', () => {
    it('el Admin lee la carta de cualquier sucursal, con los dos estados', async () => {
      await service.carta(admin, SUC_SUR);

      expect(repo.listarCarta).toHaveBeenCalledWith({
        sucursalId: SUC_SUR,
        estadosVisibles: ['activo', 'inactivo'],
      });
    });

    it('el Gerente lee la carta de su sucursal, con los dos estados', async () => {
      await service.carta(gerente, SUC_NORTE);

      expect(repo.listarCarta).toHaveBeenCalledWith({
        sucursalId: SUC_NORTE,
        estadosVisibles: ['activo', 'inactivo'],
      });
    });

    it('el Empleado lee su carta restringida a lo activo', async () => {
      await service.carta(empleado, SUC_NORTE);

      expect(repo.listarCarta).toHaveBeenCalledWith({
        sucursalId: SUC_NORTE,
        estadosVisibles: ['activo'],
      });
    });

    it('el Gerente no lee la carta de otra sucursal: 404, no 403', async () => {
      await expect(service.carta(gerente, SUC_SUR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.listarCarta).not.toHaveBeenCalled();
    });

    it('el Empleado tampoco lee la carta de otra sucursal', async () => {
      await expect(service.carta(empleado, SUC_SUR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('el alcance se comprueba antes que la existencia: no se filtra que la otra exista', async () => {
      await expect(service.carta(gerente, SUC_SUR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.existeSucursal).not.toHaveBeenCalled();
    });

    it('da 404 al Admin si la sucursal no existe', async () => {
      repo.existeSucursal.mockResolvedValue(false);

      await expect(service.carta(admin, SUC_SUR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.listarCarta).not.toHaveBeenCalled();
    });

    it('da 404 al Gerente si su propia sucursal fue borrada', async () => {
      repo.existeSucursal.mockResolvedValue(false);

      await expect(service.carta(gerente, SUC_NORTE)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('el Gerente puede filtrar por inactivo', async () => {
      await service.carta(gerente, SUC_NORTE, { estado: 'inactivo' });

      expect(repo.listarCarta).toHaveBeenCalledWith({
        sucursalId: SUC_NORTE,
        estadosVisibles: ['inactivo'],
        filtroEstado: 'inactivo',
      });
    });

    it('el Empleado que filtra por inactivo consulta con la lista visible vacia', async () => {
      await service.carta(empleado, SUC_NORTE, { estado: 'inactivo' });

      // `estadosVisibles: []` es lo que hace que la consulta no devuelva filas:
      // se filtra en la base, no en memoria. La interseccion con el filtro
      // pedido vacia la lista en vez de ignorarse.
      expect(repo.listarCarta).toHaveBeenCalledWith({
        sucursalId: SUC_NORTE,
        estadosVisibles: [],
        filtroEstado: 'inactivo',
      });
    });

    it('devuelve las filas de la carta tal cual', async () => {
      await expect(service.carta(gerente, SUC_NORTE)).resolves.toEqual([fila()]);
    });
  });

  describe('upsert', () => {
    const base = {
      sucursalId: SUC_NORTE,
      productoId: PROD_CAFE,
      varianteId: VAR_UNICA,
      precio: 2.5,
    };

    it('el Gerente crea la oferta con el estado por defecto y el precio serializado', async () => {
      await service.upsert(gerente, base);

      expect(repo.upsertOferta).toHaveBeenCalledWith({
        sucursalId: SUC_NORTE,
        productoId: PROD_CAFE,
        varianteId: VAR_UNICA,
        precio: '2.50',
        estado: ESTADO_POR_DEFECTO,
      });
    });

    it('respeta el estado pedido', async () => {
      await service.upsert(gerente, { ...base, estado: 'inactivo' });

      expect(repo.upsertOferta).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'inactivo' }),
      );
    });

    it('devuelve el precio ya formateado por el repositorio', async () => {
      const respuesta: OfertaRespuesta = { precio: '3.00', estado: 'activo' };
      repo.upsertOferta.mockResolvedValue(respuesta);

      await expect(service.upsert(gerente, { ...base, precio: 3 })).resolves.toEqual(respuesta);
    });

    it('el precio llega a la base como texto con dos decimales', async () => {
      for (const [precio, texto] of [
        [10, '10.00'],
        [2.5, '2.50'],
        [0.07, '0.07'],
        [1234.56, '1234.56'],
      ] as const) {
        repo.upsertOferta.mockClear();
        await service.upsert(gerente, { ...base, precio });

        expect(repo.upsertOferta).toHaveBeenCalledWith(
          expect.objectContaining({ precio: texto }),
        );
      }
    });

    it('el Admin NO puede editar precios: 404 y no toca la base', async () => {
      await expect(service.upsert(admin, base)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.upsertOferta).not.toHaveBeenCalled();
    });

    it('el Empleado NO puede editar precios de su propia sucursal', async () => {
      await expect(service.upsert(empleado, base)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.upsertOferta).not.toHaveBeenCalled();
    });

    it('el Gerente NO puede editar precios en otra sucursal: 404', async () => {
      await expect(
        service.upsert(gerente, { ...base, sucursalId: SUC_SUR }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.upsertOferta).not.toHaveBeenCalled();
    });

    it('da 400 con un precio fuera de rango, y no toca la base', async () => {
      for (const precio of [0, -1, 100000.01, 1.234]) {
        repo.upsertOferta.mockClear();
        await expect(
          service.upsert(gerente, { ...base, precio }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(repo.upsertOferta).not.toHaveBeenCalled();
      }
    });

    it('da 404 si el producto no existe', async () => {
      repo.existeProducto.mockResolvedValue(false);

      await expect(service.upsert(gerente, base)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.upsertOferta).not.toHaveBeenCalled();
    });

    it('da 404 si la variante no existe', async () => {
      repo.existeVariante.mockResolvedValue(false);

      await expect(service.upsert(gerente, base)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.upsertOferta).not.toHaveBeenCalled();
    });

    it('valida el precio antes de preguntar por el producto', async () => {
      await expect(service.upsert(gerente, { ...base, precio: 0 })).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(repo.existeProducto).not.toHaveBeenCalled();
    });
  });
});
