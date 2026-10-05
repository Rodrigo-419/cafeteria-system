import { ConflictException, NotFoundException } from '@nestjs/common';

jest.mock('./products.repository', () => ({
  ProductsRepository: class ProductsRepository {},
}));

import { CategoriasService } from './categorias.service';
import type {
  CategoriaRespuesta,
  ProductsRepository,
} from './products.repository';

type Repo = {
  listarCategorias: jest.Mock;
  buscarCategoriaPorId: jest.Mock;
  contarProductosDeCategoria: jest.Mock;
  existeCategoria: jest.Mock;
  nombreCategoriaEnUso: jest.Mock;
  crearCategoria: jest.Mock;
  actualizarCategoria: jest.Mock;
  eliminarCategoria: jest.Mock;
};

const FECHA = new Date('2026-01-01T00:00:00.000Z');

function categoria(over: Partial<CategoriaRespuesta> = {}): CategoriaRespuesta {
  return {
    id: 'cat-bebidas',
    nombre: 'Bebidas',
    createdAt: FECHA,
    updatedAt: FECHA,
    ...over,
  };
}

describe('CategoriasService', () => {
  let repo: Repo;
  let service: CategoriasService;

  beforeEach(() => {
    repo = {
      listarCategorias: jest.fn().mockResolvedValue([categoria()]),
      buscarCategoriaPorId: jest.fn().mockResolvedValue(categoria()),
      contarProductosDeCategoria: jest.fn().mockResolvedValue(0),
      existeCategoria: jest.fn().mockResolvedValue(true),
      nombreCategoriaEnUso: jest.fn().mockResolvedValue(false),
      crearCategoria: jest.fn().mockResolvedValue(categoria({ id: 'cat-nueva' })),
      actualizarCategoria: jest.fn().mockResolvedValue(categoria({ nombre: 'Comidas' })),
      eliminarCategoria: jest.fn().mockResolvedValue(undefined),
    };

    service = new CategoriasService(repo as unknown as ProductsRepository);
  });

  describe('listar y obtener', () => {
    it('lista las categorias', async () => {
      await expect(service.listar()).resolves.toEqual([categoria()]);
      expect(repo.listarCategorias).toHaveBeenCalledTimes(1);
    });

    it('obtiene una categoria existente', async () => {
      await expect(service.obtener('cat-bebidas')).resolves.toEqual(categoria());
    });

    it('da 404 si la categoria no existe', async () => {
      repo.buscarCategoriaPorId.mockResolvedValue(null);

      await expect(service.obtener('cat-inexistente')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('crear', () => {
    it('crea la categoria y la devuelve', async () => {
      const resultado = await service.crear('Postres');

      expect(resultado).toEqual(categoria({ id: 'cat-nueva' }));
      expect(repo.crearCategoria).toHaveBeenCalledWith('Postres');
    });

    it('recorta el nombre antes de crear', async () => {
      await service.crear('  Postres  ');

      expect(repo.crearCategoria).toHaveBeenCalledWith('Postres');
    });

    it('da 409 si el nombre ya esta en uso, ignorando mayusculas', async () => {
      repo.nombreCategoriaEnUso.mockResolvedValue(true);

      await expect(service.crear('Bebidas')).rejects.toBeInstanceOf(ConflictException);
      expect(repo.crearCategoria).not.toHaveBeenCalled();
    });

    it('comprueba el duplicado contra el nombre ya recortado', async () => {
      await service.crear('  Bebidas  ');

      expect(repo.nombreCategoriaEnUso).toHaveBeenCalledWith('Bebidas');
    });
  });

  describe('actualizar', () => {
    it('renombra la categoria', async () => {
      const resultado = await service.actualizar('cat-bebidas', '  Comidas  ');

      expect(resultado).toEqual(categoria({ nombre: 'Comidas' }));
      expect(repo.actualizarCategoria).toHaveBeenCalledWith('cat-bebidas', 'Comidas');
    });

    it('da 404 si la categoria no existe, sin tocar el nombre', async () => {
      repo.buscarCategoriaPorId.mockResolvedValue(null);

      await expect(
        service.actualizar('cat-inexistente', 'Comidas'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.nombreCategoriaEnUso).not.toHaveBeenCalled();
      expect(repo.actualizarCategoria).not.toHaveBeenCalled();
    });

    it('da 409 si el nuevo nombre lo usa otra categoria', async () => {
      repo.nombreCategoriaEnUso.mockResolvedValue(true);

      await expect(service.actualizar('cat-bebidas', 'Comidas')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.actualizarCategoria).not.toHaveBeenCalled();
    });

    it('excluye a si misma de la comprobacion de duplicado', async () => {
      await service.actualizar('cat-bebidas', 'Bebidas');

      expect(repo.nombreCategoriaEnUso).toHaveBeenCalledWith('Bebidas', 'cat-bebidas');
    });
  });

  describe('eliminar', () => {
    it('borra una categoria vacia', async () => {
      await service.eliminar('cat-bebidas');

      expect(repo.eliminarCategoria).toHaveBeenCalledWith('cat-bebidas');
    });

    it('da 409 si la categoria tiene productos, y no borra', async () => {
      repo.contarProductosDeCategoria.mockResolvedValue(3);

      await expect(service.eliminar('cat-bebidas')).rejects.toBeInstanceOf(ConflictException);
      expect(repo.eliminarCategoria).not.toHaveBeenCalled();
    });

    it('el 409 explica que hay que mover los productos', async () => {
      repo.contarProductosDeCategoria.mockResolvedValue(1);

      await expect(service.eliminar('cat-bebidas')).rejects.toThrow(/productos/i);
    });

    it('da 404 si la categoria no existe', async () => {
      repo.buscarCategoriaPorId.mockResolvedValue(null);

      await expect(service.eliminar('cat-inexistente')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.contarProductosDeCategoria).not.toHaveBeenCalled();
    });
  });
});
