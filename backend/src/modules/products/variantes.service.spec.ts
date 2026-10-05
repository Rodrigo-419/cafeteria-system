import { ConflictException, NotFoundException } from '@nestjs/common';

jest.mock('./products.repository', () => ({
  ProductsRepository: class ProductsRepository {},
}));

import { VariantesService } from './variantes.service';
import { NOMBRE_VARIANTE_BASE } from './products.rules';
import type {
  ProductsRepository,
  VarianteRespuesta,
} from './products.repository';

type Repo = {
  listarVariantes: jest.Mock;
  buscarVariantePorId: jest.Mock;
  contarOfertasDeVariante: jest.Mock;
  existeVariante: jest.Mock;
  nombreVarianteEnUso: jest.Mock;
  crearVariante: jest.Mock;
  actualizarVariante: jest.Mock;
  eliminarVariante: jest.Mock;
};

const FECHA = new Date('2026-01-01T00:00:00.000Z');

function variante(over: Partial<VarianteRespuesta> = {}): VarianteRespuesta {
  return {
    id: 'var-chico',
    nombre: 'Chico',
    createdAt: FECHA,
    updatedAt: FECHA,
    ...over,
  };
}

/** La variante base tal como la deja el seed. */
function varianteBase(): VarianteRespuesta {
  return variante({ id: 'var-unica', nombre: NOMBRE_VARIANTE_BASE });
}

describe('VariantesService', () => {
  let repo: Repo;
  let service: VariantesService;

  beforeEach(() => {
    repo = {
      listarVariantes: jest.fn().mockResolvedValue([variante()]),
      buscarVariantePorId: jest.fn().mockResolvedValue(variante()),
      contarOfertasDeVariante: jest.fn().mockResolvedValue(0),
      existeVariante: jest.fn().mockResolvedValue(true),
      nombreVarianteEnUso: jest.fn().mockResolvedValue(false),
      crearVariante: jest.fn().mockResolvedValue(variante({ id: 'var-nueva' })),
      actualizarVariante: jest.fn().mockResolvedValue(variante({ nombre: 'Mediano' })),
      eliminarVariante: jest.fn().mockResolvedValue(undefined),
    };

    service = new VariantesService(repo as unknown as ProductsRepository);
  });

  describe('listar y obtener', () => {
    it('lista las variantes', async () => {
      await expect(service.listar()).resolves.toEqual([variante()]);
    });

    it('obtiene una variante existente', async () => {
      await expect(service.obtener('var-chico')).resolves.toEqual(variante());
    });

    it('da 404 si la variante no existe', async () => {
      repo.buscarVariantePorId.mockResolvedValue(null);

      await expect(service.obtener('var-inexistente')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('crear', () => {
    it('crea la variante y la devuelve', async () => {
      await expect(service.crear('  Mediano  ')).resolves.toEqual(
        variante({ id: 'var-nueva' }),
      );
      expect(repo.crearVariante).toHaveBeenCalledWith('Mediano');
    });

    it('da 409 si el nombre ya esta en uso', async () => {
      repo.nombreVarianteEnUso.mockResolvedValue(true);

      await expect(service.crear('Chico')).rejects.toBeInstanceOf(ConflictException);
      expect(repo.crearVariante).not.toHaveBeenCalled();
    });

    it('da 409 al intentar crear otra variante base con el mismo nombre', async () => {
      await expect(service.crear(NOMBRE_VARIANTE_BASE)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.crearVariante).not.toHaveBeenCalled();
    });

    it('da 409 a una variante base con otro nombre pero equivalente', async () => {
      await expect(service.crear('  única ')).rejects.toBeInstanceOf(ConflictException);
      expect(repo.crearVariante).not.toHaveBeenCalled();
    });

    it('no confunde el nombre base con una variante que lo contiene', async () => {
      await expect(service.crear('Única XL')).resolves.toEqual(variante({ id: 'var-nueva' }));
    });
  });

  describe('actualizar', () => {
    it('renombra una variante normal', async () => {
      const resultado = await service.actualizar('var-chico', '  Mediano  ');

      expect(resultado).toEqual(variante({ nombre: 'Mediano' }));
      expect(repo.actualizarVariante).toHaveBeenCalledWith('var-chico', 'Mediano');
    });

    it('da 409 al intentar renombrar la variante base', async () => {
      repo.buscarVariantePorId.mockResolvedValue(varianteBase());

      await expect(service.actualizar('var-unica', 'Simple')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.actualizarVariante).not.toHaveBeenCalled();
    });

    it('da 409 al intentar renombrar la base solo por diferencias de espacios', async () => {
      repo.buscarVariantePorId.mockResolvedValue(varianteBase());

      await expect(
        service.actualizar('var-unica', '  ÚNICA '),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('da 409 si el nuevo nombre lo usa otra variante', async () => {
      repo.nombreVarianteEnUso.mockResolvedValue(true);

      await expect(service.actualizar('var-chico', 'Grande')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.actualizarVariante).not.toHaveBeenCalled();
    });

    it('excluye a si misma de la comprobacion de duplicado', async () => {
      await service.actualizar('var-chico', 'Chico');

      expect(repo.nombreVarianteEnUso).toHaveBeenCalledWith('Chico', 'var-chico');
    });

    it('da 404 si la variante no existe', async () => {
      repo.buscarVariantePorId.mockResolvedValue(null);

      await expect(service.actualizar('var-inexistente', 'Mediano')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('eliminar', () => {
    it('borra una variante sin ofertas', async () => {
      await service.eliminar('var-chico');

      expect(repo.eliminarVariante).toHaveBeenCalledWith('var-chico');
    });

    it('da 409 al borrar la variante base', async () => {
      repo.buscarVariantePorId.mockResolvedValue(varianteBase());

      await expect(service.eliminar('var-unica')).rejects.toBeInstanceOf(ConflictException);
      expect(repo.eliminarVariante).not.toHaveBeenCalled();
    });

    it('da 409 si la variante tiene ofertas en alguna sucursal', async () => {
      repo.contarOfertasDeVariante.mockResolvedValue(2);

      await expect(service.eliminar('var-chico')).rejects.toBeInstanceOf(ConflictException);
      expect(repo.eliminarVariante).not.toHaveBeenCalled();
    });

    it('el 409 explica que hay que desactivar las ofertas', async () => {
      repo.contarOfertasDeVariante.mockResolvedValue(1);

      await expect(service.eliminar('var-chico')).rejects.toThrow(/desactiva/i);
    });

    it('da 404 si la variante no existe', async () => {
      repo.buscarVariantePorId.mockResolvedValue(null);

      await expect(service.eliminar('var-inexistente')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.contarOfertasDeVariante).not.toHaveBeenCalled();
    });
  });
});
