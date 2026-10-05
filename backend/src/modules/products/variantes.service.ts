// Logica de negocio de variantes de producto.
//
// La variante base ("Unica") es una pieza del sistema: el seed la crea y los
// productos simples la usan. Renombrarla o borrarla dejaria el catalogo
// incoherente, asi que se protege con 409.
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ProductsRepository,
  type VarianteRespuesta,
} from './products.repository';
import { esVarianteBase, NOMBRE_VARIANTE_BASE } from './products.rules';

const VARIANTE_NO_ENCONTRADA = 'Variante no encontrada';
const NOMBRE_DUPLICADO = 'Ya existe una variante con ese nombre';
const BASE_PROTEGIDA = `La variante "${NOMBRE_VARIANTE_BASE}" es del sistema y no se puede modificar`;

@Injectable()
export class VariantesService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  listar(): Promise<VarianteRespuesta[]> {
    return this.productsRepository.listarVariantes();
  }

  obtener(id: string): Promise<VarianteRespuesta> {
    return this.exigirVariante(id);
  }

  async crear(nombre: string): Promise<VarianteRespuesta> {
    const limpio = nombre.trim();

    // No se puede crear una segunda variante base con otro nombre: seria la
    // misma variante con dos identidades.
    if (esVarianteBase(limpio)) {
      throw new ConflictException(NOMBRE_DUPLICADO);
    }

    if (await this.productsRepository.nombreVarianteEnUso(limpio)) {
      throw new ConflictException(NOMBRE_DUPLICADO);
    }

    return this.productsRepository.crearVariante(limpio);
  }

  async actualizar(id: string, nombre: string): Promise<VarianteRespuesta> {
    const variante = await this.exigirVariante(id);

    if (esVarianteBase(variante.nombre)) {
      throw new ConflictException(BASE_PROTEGIDA);
    }

    const limpio = nombre.trim();
    if (await this.productsRepository.nombreVarianteEnUso(limpio, id)) {
      throw new ConflictException(NOMBRE_DUPLICADO);
    }

    return this.productsRepository.actualizarVariante(id, limpio);
  }

  async eliminar(id: string): Promise<void> {
    const variante = await this.exigirVariante(id);

    if (esVarianteBase(variante.nombre)) {
      throw new ConflictException(BASE_PROTEGIDA);
    }

    // Si la variante aparece en la carta de alguna sucursal, borrarla dejaria
    // ofertas huerfanas, que la base no permite.
    const ofertas = await this.productsRepository.contarOfertasDeVariante(id);
    if (ofertas > 0) {
      throw new ConflictException(
        'La variante tiene precios en alguna sucursal: desactiva esas ofertas antes de borrarla',
      );
    }

    await this.productsRepository.eliminarVariante(id);
  }

  private async exigirVariante(id: string): Promise<VarianteRespuesta> {
    const variante = await this.productsRepository.buscarVariantePorId(id);
    if (!variante) {
      throw new NotFoundException(VARIANTE_NO_ENCONTRADA);
    }
    return variante;
  }
}
