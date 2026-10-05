// Logica de negocio de las ofertas de producto por sucursal: la carta y los
// precios.
//
// Dos alcances distintos:
//   - VER la carta: Admin cualquier sucursal, Gerente y Empleado la suya.
//   - EDITAR precios: solo el Gerente, y solo en su sucursal.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CartaFila,
  type OfertaRespuesta,
  ProductsRepository,
} from './products.repository';
import {
  estadosVisiblesConFiltro,
  type ActorProductos,
  type EstadoOferta,
  esPrecioValido,
  puedeEditarPrecios,
  puedeVerPrecios,
  precioATextoDecimal,
} from './products.rules';

export const ESTADO_POR_DEFECTO: EstadoOferta = 'activo';

const SUCURSAL_NO_ENCONTRADA = 'Sucursal no encontrada';
const PRODUCTO_NO_ENCONTRADO = 'Producto no encontrado';
const VARIANTE_NO_ENCONTRADA = 'Variante no encontrada';

@Injectable()
export class OfertasService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  /**
   * Carta de una sucursal: producto, categoria, variante, precio y estado.
   *
   * Una sucursal que no existe responde 404 tambien al Admin, porque la ruta va
   * por `sucursalId` y es ese el recurso que se pidio.
   */
  async carta(
    actor: ActorProductos,
    sucursalId: string,
    filtro?: { estado?: EstadoOferta },
  ): Promise<CartaFila[]> {
    // El alcance se comprueba antes que la existencia: un Gerente que pide otra
    // sucursal obtiene 404 tanto si existe como si no, y no se le confirma que
    // exista. El Admin, que ve todas, si cae en el 404 de existencia.
    if (!puedeVerPrecios(actor, sucursalId)) {
      throw new NotFoundException(SUCURSAL_NO_ENCONTRADA);
    }

    if (!(await this.productsRepository.existeSucursal(sucursalId))) {
      throw new NotFoundException(SUCURSAL_NO_ENCONTRADA);
    }

    const filtroEstado = filtro?.estado;

    return this.productsRepository.listarCarta({
      sucursalId,
      // La regla recorta el filtro a lo visible por el rol: el Empleado que pide
      // `?estado=inactivo` se queda con la lista vacia, no con la de Gerente.
      estadosVisibles: estadosVisiblesConFiltro({
        rol: actor.rol,
        ...(filtroEstado !== undefined ? { filtro: filtroEstado } : {}),
      }),
      ...(filtroEstado !== undefined ? { filtroEstado } : {}),
    });
  }

  /**
   * Crea o actualiza la oferta de una variante de un producto en la sucursal del
   * Gerente. No hay DELETE de ofertas: se desactivan con `estado: "inactivo"`.
   */
  async upsert(
    actor: ActorProductos,
    params: {
      sucursalId: string;
      productoId: string;
      varianteId: string;
      precio: number;
      estado?: EstadoOferta;
    },
  ): Promise<OfertaRespuesta> {
    // Otra sucursal -> 404, para no revelar que ahi hay precios.
    if (!puedeEditarPrecios(actor, params.sucursalId)) {
      throw new NotFoundException(SUCURSAL_NO_ENCONTRADA);
    }

    if (!esPrecioValido(params.precio)) {
      throw new BadRequestException('El precio no es valido');
    }

    if (!(await this.productsRepository.existeProducto(params.productoId))) {
      throw new NotFoundException(PRODUCTO_NO_ENCONTRADO);
    }

    if (!(await this.productsRepository.existeVariante(params.varianteId))) {
      throw new NotFoundException(VARIANTE_NO_ENCONTRADA);
    }

    return this.productsRepository.upsertOferta({
      productoId: params.productoId,
      sucursalId: params.sucursalId,
      varianteId: params.varianteId,
      // Se serializa aqui el decimal: el repositorio no recibe nunca un `number`
      // para una columna Decimal.
      precio: precioATextoDecimal(params.precio),
      estado: params.estado ?? ESTADO_POR_DEFECTO,
    });
  }
}
