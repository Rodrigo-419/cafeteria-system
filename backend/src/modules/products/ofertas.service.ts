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
import { AuditoriaRepository } from '../auditoria/infrastructure/auditoria.repository';
import {
  type CartaFila,
  type ClienteProductos,
  type OfertaRespuesta,
  ProductsRepository,
} from './products.repository';
import {
  type ActorProductos,
  type EstadoOferta,
  estadosVisiblesConFiltro,
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
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

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
   *
   * La lectura del estado previo, el upsert y el evento de auditoria van en la
   * misma transaccion: el evento describe con exactitud el cambio realizado.
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

    return this.productsRepository.enTransaccion(async (cliente) => {
      const previa = await this.productsRepository.buscarOferta(
        params.productoId,
        params.sucursalId,
        params.varianteId,
        cliente,
      );

      const oferta = await this.productsRepository.upsertOferta(
        {
          productoId: params.productoId,
          sucursalId: params.sucursalId,
          varianteId: params.varianteId,
          // Se serializa aqui el decimal: el repositorio no recibe nunca un
          // `number` para una columna Decimal.
          precio: precioATextoDecimal(params.precio),
          estado: params.estado ?? ESTADO_POR_DEFECTO,
        },
        cliente,
      );

      await this.registrarCambio(actor.id, params, previa, oferta, cliente);

      return { precio: oferta.precio, estado: oferta.estado };
    });
  }

  // ------------------------------------------------------------------ privado

  /**
   * Deriva del estado previo y del nuevo los eventos que correspondan: alta,
   * cambio de precio y activacion/desactivacion. Un upsert que cambia precio y
   * estado a la vez deja dos eventos.
   */
  private async registrarCambio(
    actorId: string,
    params: { sucursalId: string; productoId: string; varianteId: string },
    previa: OfertaRespuesta | null,
    oferta: OfertaRespuesta & { id: string },
    cliente: ClienteProductos,
  ): Promise<void> {
    const base = {
      entidad: 'oferta' as const,
      entidadId: oferta.id,
      actorId,
      sucursalAfectadaId: params.sucursalId,
    };

    if (previa === null) {
      await this.auditoria.registrar(
        {
          ...base,
          accion: 'oferta_creada',
          detalle: {
            despues: {
              productoId: params.productoId,
              varianteId: params.varianteId,
              precio: oferta.precio,
              estado: oferta.estado,
            },
          },
        },
        cliente,
      );
      return;
    }

    if (previa.precio !== oferta.precio) {
      await this.auditoria.registrar(
        {
          ...base,
          accion: 'oferta_precio_fijado',
          detalle: {
            antes: { precio: previa.precio },
            despues: { precio: oferta.precio },
          },
        },
        cliente,
      );
    }

    if (previa.estado !== oferta.estado) {
      await this.auditoria.registrar(
        {
          ...base,
          accion:
            oferta.estado === 'activo' ? 'oferta_activada' : 'oferta_desactivada',
          detalle: {
            antes: { estado: previa.estado },
            despues: { estado: oferta.estado },
          },
        },
        cliente,
      );
    }
  }
}
