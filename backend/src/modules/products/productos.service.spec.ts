import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

jest.mock('./products.repository', () => ({
  ProductsRepository: class ProductsRepository {},
}));

import {
  LIMIT_MAXIMO,
  LIMIT_POR_DEFECTO,
  PAGE_POR_DEFECTO,
  ProductosService,
} from './productos.service';
import type {
  ProductoRespuesta,
  ProductsRepository,
} from './products.repository';

type Repo = {
  listarProductos: jest.Mock;
  contarProductos: jest.Mock;
  buscarProductoPorId: jest.Mock;
  existeProducto: jest.Mock;
  contarOfertasDeProducto: jest.Mock;
  existeCategoria: jest.Mock;
  nombreProductoEnUso: jest.Mock;
  crearProducto: jest.Mock;
  actualizarProducto: jest.Mock;
  eliminarProducto: jest.Mock;
};

const FECHA = new Date('2026-01-01T00:00:00.000Z');
const CAT_BEBIDAS = 'cat-bebidas';
const CAT_COMIDAS = 'cat-comidas';

function producto(over: Partial<ProductoRespuesta> = {}): ProductoRespuesta {
  return {
    id: 'prod-cafe',
    nombre: 'Cafe',
    categoriaId: CAT_BEBIDAS,
    descripcion: null,
    createdAt: FECHA,
    updatedAt: FECHA,
    categoria: { id: CAT_BEBIDAS, nombre: 'Bebidas' },
    ...over,
  };
}

describe('ProductosService', () => {
  let repo: Repo;
  let service: ProductosService;

  beforeEach(() => {
    repo = {
      listarProductos: jest.fn().mockResolvedValue([producto()]),
      contarProductos: jest.fn().mockResolvedValue(1),
      buscarProductoPorId: jest.fn().mockResolvedValue(producto()),
      existeProducto: jest.fn().mockResolvedValue(true),
      contarOfertasDeProducto: jest.fn().mockResolvedValue(0),
      existeCategoria: jest.fn().mockResolvedValue(true),
      nombreProductoEnUso: jest.fn().mockResolvedValue(false),
      crearProducto: jest.fn().mockResolvedValue(producto({ id: 'prod-nuevo' })),
      actualizarProducto: jest.fn().mockResolvedValue(producto()),
      eliminarProducto: jest.fn().mockResolvedValue(undefined),
    };

    service = new ProductosService(repo as unknown as ProductsRepository);
  });

  describe('listar', () => {
    it('devuelve la primera pagina por defecto, con su envoltorio', async () => {
      repo.contarProductos.mockResolvedValue(1);

      const resultado = await service.listar({});

      expect(resultado).toEqual({
        data: [producto()],
        total: 1,
        page: PAGE_POR_DEFECTO,
        limit: LIMIT_POR_DEFECTO,
        totalPaginas: 1,
      });
      expect(repo.listarProductos).toHaveBeenCalledWith({
        page: PAGE_POR_DEFECTO,
        limit: LIMIT_POR_DEFECTO,
      });
    });

    it('calcula las paginas totales a partir del total', async () => {
      repo.contarProductos.mockResolvedValue(45);

      const resultado = await service.listar({ page: 2, limit: 20 });

      expect(resultado.totalPaginas).toBe(3);
      expect(resultado.page).toBe(2);
      expect(resultado.limit).toBe(20);
    });

    it('devuelve cero paginas cuando no hay productos', async () => {
      repo.listarProductos.mockResolvedValue([]);
      repo.contarProductos.mockResolvedValue(0);

      const resultado = await service.listar({});

      expect(resultado.totalPaginas).toBe(0);
      expect(resultado.data).toEqual([]);
    });

    it('acota el limite al maximo', async () => {
      const resultado = await service.listar({ limit: 9999 });

      expect(resultado.limit).toBe(LIMIT_MAXIMO);
    });

    it('recorta la busqueda y no la pasa si queda vacia', async () => {
      await service.listar({ q: '   ' });

      expect(repo.listarProductos).toHaveBeenCalledWith(
        expect.not.objectContaining({ busqueda: expect.anything() }),
      );
    });

    it('pasa la busqueda recortada cuando si hay texto', async () => {
      await service.listar({ q: '  cafe  ' });

      expect(repo.listarProductos).toHaveBeenCalledWith(
        expect.objectContaining({ busqueda: 'cafe' }),
      );
    });

    it('pasa el filtro de categoria sin tocarlo', async () => {
      await service.listar({ categoriaId: CAT_COMIDAS });

      expect(repo.listarProductos).toHaveBeenCalledWith(
        expect.objectContaining({ categoriaId: CAT_COMIDAS }),
      );
    });

    it('cuenta y lista con los mismos filtros', async () => {
      await service.listar({ categoriaId: CAT_COMIDAS, q: 'torta' });

      const filtros = { page: 1, limit: 20, categoriaId: CAT_COMIDAS, busqueda: 'torta' };
      expect(repo.listarProductos).toHaveBeenCalledWith(filtros);
      expect(repo.contarProductos).toHaveBeenCalledWith(filtros);
    });
  });

  describe('obtener', () => {
    it('obtiene un producto existente', async () => {
      await expect(service.obtener('prod-cafe')).resolves.toEqual(producto());
    });

    it('da 404 si el producto no existe', async () => {
      repo.buscarProductoPorId.mockResolvedValue(null);

      await expect(service.obtener('prod-inexistente')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('crear', () => {
    it('crea el producto en la categoria indicada', async () => {
      const resultado = await service.crear({
        nombre: '  Cafe  ',
        categoriaId: CAT_BEBIDAS,
      });

      expect(resultado).toEqual(producto({ id: 'prod-nuevo' }));
      expect(repo.crearProducto).toHaveBeenCalledWith({
        nombre: 'Cafe',
        categoriaId: CAT_BEBIDAS,
        descripcion: null,
      });
    });

    it('conserva la descripcion si viene', async () => {
      await service.crear({
        nombre: 'Cafe',
        categoriaId: CAT_BEBIDAS,
        descripcion: '  Blend de la casa  ',
      });

      expect(repo.crearProducto).toHaveBeenCalledWith(
        expect.objectContaining({ descripcion: 'Blend de la casa' }),
      );
    });

    it('da 400 si la categoria no existe, en vez de 404', async () => {
      repo.existeCategoria.mockResolvedValue(false);

      await expect(
        service.crear({ nombre: 'Cafe', categoriaId: 'cat-fantasma' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.crearProducto).not.toHaveBeenCalled();
    });

    it('da 409 si el nombre ya existe en esa misma categoria', async () => {
      repo.nombreProductoEnUso.mockResolvedValue(true);

      await expect(
        service.crear({ nombre: 'Cafe', categoriaId: CAT_BEBIDAS }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.crearProducto).not.toHaveBeenCalled();
    });

    it('el 409 de nombre menciona la categoria', async () => {
      repo.nombreProductoEnUso.mockResolvedValue(true);

      await expect(
        service.crear({ nombre: 'Cafe', categoriaId: CAT_BEBIDAS }),
      ).rejects.toThrow(/categoria/i);
    });
  });

  describe('actualizar', () => {
    it('cambia solo el nombre', async () => {
      await service.actualizar('prod-cafe', { nombre: '  Cafe de olla  ' });

      expect(repo.actualizarProducto).toHaveBeenCalledWith('prod-cafe', {
        nombre: 'Cafe de olla',
      });
    });

    it('cambia solo la categoria', async () => {
      await service.actualizar('prod-cafe', { categoriaId: CAT_COMIDAS });

      expect(repo.existeCategoria).toHaveBeenCalledWith(CAT_COMIDAS);
      expect(repo.actualizarProducto).toHaveBeenCalledWith('prod-cafe', {
        categoriaId: CAT_COMIDAS,
      });
    });

    it('comprueba el nombre contra la categoria de destino al moverlo', async () => {
      await service.actualizar('prod-cafe', { categoriaId: CAT_COMIDAS });

      expect(repo.nombreProductoEnUso).toHaveBeenCalledWith(
        'Cafe',
        CAT_COMIDAS,
        'prod-cafe',
      );
    });

    it('da 409 si el nombre choca en la categoria de destino', async () => {
      repo.nombreProductoEnUso.mockResolvedValue(true);

      await expect(
        service.actualizar('prod-cafe', { categoriaId: CAT_COMIDAS }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.actualizarProducto).not.toHaveBeenCalled();
    });

    it('da 409 si el nombre nuevo choca en la misma categoria', async () => {
      repo.nombreProductoEnUso.mockResolvedValue(true);

      await expect(
        service.actualizar('prod-cafe', { nombre: 'Latte' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('da 400 si se mueve a una categoria inexistente', async () => {
      repo.existeCategoria.mockResolvedValue(false);

      await expect(
        service.actualizar('prod-cafe', { categoriaId: 'cat-fantasma' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.actualizarProducto).not.toHaveBeenCalled();
    });

    it('permite conservar el nombre al editar la descripcion', async () => {
      await service.actualizar('prod-cafe', { descripcion: 'Nuevo texto' });

      expect(repo.nombreProductoEnUso).not.toHaveBeenCalled();
      expect(repo.actualizarProducto).toHaveBeenCalledWith('prod-cafe', {
        descripcion: 'Nuevo texto',
      });
    });

    it('limpia la descripcion vacia a null', async () => {
      await service.actualizar('prod-cafe', { descripcion: '   ' });

      expect(repo.actualizarProducto).toHaveBeenCalledWith('prod-cafe', { descripcion: null });
    });

    it('da 404 si el producto no existe', async () => {
      repo.buscarProductoPorId.mockResolvedValue(null);

      await expect(
        service.actualizar('prod-inexistente', { nombre: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.actualizarProducto).not.toHaveBeenCalled();
    });

    it('no toca la base si no viene nada que editar', async () => {
      await service.actualizar('prod-cafe', {});

      expect(repo.nombreProductoEnUso).not.toHaveBeenCalled();
      expect(repo.actualizarProducto).toHaveBeenCalledWith('prod-cafe', {});
    });
  });

  describe('eliminar', () => {
    it('borra un producto sin precios', async () => {
      await service.eliminar('prod-cafe');

      expect(repo.eliminarProducto).toHaveBeenCalledWith('prod-cafe');
    });

    it('da 409 si el producto tiene precios en alguna sucursal', async () => {
      repo.contarOfertasDeProducto.mockResolvedValue(2);

      await expect(service.eliminar('prod-cafe')).rejects.toBeInstanceOf(ConflictException);
      expect(repo.eliminarProducto).not.toHaveBeenCalled();
    });

    it('el 409 dice que se desactive en cada sucursal, no que se borre', async () => {
      repo.contarOfertasDeProducto.mockResolvedValue(1);

      await expect(service.eliminar('prod-cafe')).rejects.toThrow(/desactiva/i);
    });

    it('da 404 si el producto no existe', async () => {
      repo.buscarProductoPorId.mockResolvedValue(null);

      await expect(service.eliminar('prod-inexistente')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.contarOfertasDeProducto).not.toHaveBeenCalled();
    });
  });
});
