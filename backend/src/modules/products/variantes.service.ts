// Logica de negocio de variantes de producto.
//
// La variante base ("Unica") es una pieza del sistema: el seed la crea y los
// productos simples la usan. Renombrarla o borrarla dejaria el catalogo
// incoherente, asi que se protege con 409.
//
// El catalogo es global: sus eventos de auditoria van con la sucursal afectada
// en null.
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaRepository } from '../auditoria/infrastructure/auditoria.repository';
import {
  type ClienteProductos,
  ProductsRepository,
  type VarianteRespuesta,
} from './products.repository';
import { esVarianteBase, NOMBRE_VARIANTE_BASE } from './products.rules';

const VARIANTE_NO_ENCONTRADA = 'Variante no encontrada';
const NOMBRE_DUPLICADO = 'Ya existe una variante con ese nombre';
const BASE_PROTEGIDA = `La variante "${NOMBRE_VARIANTE_BASE}" es del sistema y no se puede modificar`;

@Injectable()
export class VariantesService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  listar(): Promise<VarianteRespuesta[]> {
    return this.productsRepository.listarVariantes();
  }

  obtener(id: string): Promise<VarianteRespuesta> {
    return this.exigirVariante(id);
  }

  async crear(actorId: string, nombre: string): Promise<VarianteRespuesta> {
    const limpio = nombre.trim();

    // No se puede crear una segunda variante base con otro nombre: seria la
    // misma variante con dos identidades.
    if (esVarianteBase(limpio)) {
      throw new ConflictException(NOMBRE_DUPLICADO);
    }

    return this.productsRepository.enTransaccion(async (cliente) => {
      if (
        await this.productsRepository.nombreVarianteEnUso(
          limpio,
          undefined,
          cliente,
        )
      ) {
        throw new ConflictException(NOMBRE_DUPLICADO);
      }

      const variante = await this.productsRepository.crearVariante(
        limpio,
        cliente,
      );

      await this.auditoria.registrar(
        {
          entidad: 'variante',
          entidadId: variante.id,
          accion: 'variante_creada',
          actorId,
          detalle: { despues: { nombre: variante.nombre } },
        },
        cliente,
      );

      return variante;
    });
  }

  async actualizar(
    actorId: string,
    id: string,
    nombre: string,
  ): Promise<VarianteRespuesta> {
    const limpio = nombre.trim();

    return this.productsRepository.enTransaccion(async (cliente) => {
      const actual = await this.exigirVariante(id, cliente);

      if (esVarianteBase(actual.nombre)) {
        throw new ConflictException(BASE_PROTEGIDA);
      }

      if (
        await this.productsRepository.nombreVarianteEnUso(limpio, id, cliente)
      ) {
        throw new ConflictException(NOMBRE_DUPLICADO);
      }

      const variante = await this.productsRepository.actualizarVariante(
        id,
        limpio,
        cliente,
      );

      if (variante.nombre !== actual.nombre) {
        await this.auditoria.registrar(
          {
            entidad: 'variante',
            entidadId: variante.id,
            accion: 'variante_editada',
            actorId,
            detalle: {
              antes: { nombre: actual.nombre },
              despues: { nombre: variante.nombre },
            },
          },
          cliente,
        );
      }

      return variante;
    });
  }

  async eliminar(actorId: string, id: string): Promise<void> {
    await this.productsRepository.enTransaccion(async (cliente) => {
      const variante = await this.exigirVariante(id, cliente);

      if (esVarianteBase(variante.nombre)) {
        throw new ConflictException(BASE_PROTEGIDA);
      }

      // Si la variante aparece en la carta de alguna sucursal, borrarla dejaria
      // ofertas huerfanas, que la base no permite.
      const ofertas = await this.productsRepository.contarOfertasDeVariante(
        id,
        cliente,
      );
      if (ofertas > 0) {
        throw new ConflictException(
          'La variante tiene precios en alguna sucursal: desactiva esas ofertas antes de borrarla',
        );
      }

      await this.productsRepository.eliminarVariante(id, cliente);

      await this.auditoria.registrar(
        {
          entidad: 'variante',
          entidadId: variante.id,
          accion: 'variante_eliminada',
          actorId,
          detalle: { antes: { nombre: variante.nombre } },
        },
        cliente,
      );
    });
  }

  private async exigirVariante(
    id: string,
    cliente?: ClienteProductos,
  ): Promise<VarianteRespuesta> {
    const variante = await this.productsRepository.buscarVariantePorId(
      id,
      cliente,
    );
    if (!variante) {
      throw new NotFoundException(VARIANTE_NO_ENCONTRADA);
    }
    return variante;
  }
}
