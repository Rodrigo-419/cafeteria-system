import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  exigirSucursalDeRegistro,
  type ActorVentas,
} from '../../domain/rules/alcance-ventas';
import {
  aCentimos,
  centimosATexto,
  subtotalLinea,
  sumarCentimos,
} from '../../domain/rules/dinero';
import {
  esOfertaVentaActiva,
  type MetodoPagoVenta,
} from '../../domain/rules/estados-venta';
import { problemasLineas, type LineaVenta } from '../../domain/rules/lineas-venta';
import {
  SalesRepository,
  type LineaAInsertar,
} from '../../infrastructure/sales.repository';
import {
  aRespuestaVentaCompleta,
  type VentaCompletaRespuesta,
} from '../venta-respuesta';

export type EntradaRegistrarVenta = {
  metodoPago: MetodoPagoVenta;
  items: LineaVenta[];
};

/**
 * Caso de uso: registrar una venta.
 *
 * La sucursal no viene en la peticion: es la del usuario que atiende. Asi no
 * puede haber una venta "en otra sucursal" escrita a mano por el cliente, y el
 * Admin, que no esta asignado a ninguna, no puede vender (403).
 *
 * Los precios NO se aceptan del cliente. Se leen de la oferta en el momento de
 * vender y se congelan en `venta_detalle.precio_unitario_snapshot`: si mañana
 * cambia el precio de la carta, las ventas antiguas siguen contando lo que se
 * cobro. Es la razon de ser de esa columna.
 *
 * Todo ocurre dentro de una transaccion. Si dos personas vendieran la ultima
 * unidad de una oferta que esta a punto de desactivarse, o si alguna vez se
 * anade control de stock, leer y escribir juntos es lo que evita vender dos
 * veces lo mismo.
 */
@Injectable()
export class RegistrarVentaUseCase {
  constructor(private readonly salesRepository: SalesRepository) {}

  async ejecutar(
    actor: ActorVentas,
    entrada: EntradaRegistrarVenta,
  ): Promise<VentaCompletaRespuesta> {
    const sucursalId = exigirSucursalDeRegistro(actor);

    const problemas = problemasLineas(entrada.items);

    if (problemas.length > 0) {
      throw new BadRequestException({
        message: 'Las lineas de la venta no son validas',
        problemas,
      });
    }

    return this.salesRepository.enTransaccion(async (db) => {
      const ofertas = await this.salesRepository.buscarOfertas(
        entrada.items.map((linea) => linea.productoSucursalVarianteId),
        db,
      );
      const porId = new Map(ofertas.map((oferta) => [oferta.id, oferta]));

      const lineas: LineaAInsertar[] = [];
      const subtotales: number[] = [];

      for (const item of entrada.items) {
        const oferta = porId.get(item.productoSucursalVarianteId);

        // Un id que no existe y un id de otra sucursal responden igual: un 404
        // que no distingue entre "no existe" y "existe pero no es tuya".
        if (oferta === undefined || oferta.sucursalId !== sucursalId) {
          throw new NotFoundException('La oferta no existe');
        }

        if (!esOfertaVentaActiva(oferta.estado)) {
          throw new ConflictException('La oferta no esta activa');
        }

        const precio = aCentimos(oferta.precio);

        if (precio === null) {
          // La oferta no deberia poder guardarse con un precio que no es
          // representable, pero si lo esta, vender con el romperia la columna.
          throw new ConflictException('El precio de la oferta no es valido');
        }

        const subtotal = subtotalLinea(precio, item.cantidad);

        if (subtotal === null) {
          throw new BadRequestException({
            message: 'El importe de la linea supera el maximo permitido',
          });
        }

        lineas.push({
          productoSucursalVarianteId: oferta.id,
          cantidad: item.cantidad,
          precioUnitarioSnapshot: centimosATexto(precio),
          subtotal: centimosATexto(subtotal),
        });
        subtotales.push(subtotal);
      }

      const total = sumarCentimos(subtotales);

      if (total === null) {
        // Cada linea por separado cabe en la columna, pero juntas no.
        throw new BadRequestException({
          message: 'El total de la venta supera el maximo permitido',
        });
      }

      const venta = await this.salesRepository.crearVenta(
        {
          sucursalId,
          usuarioId: actor.id,
          metodoPago: entrada.metodoPago,
        },
        db,
      );

      await this.salesRepository.crearDetalles(venta.id, lineas, db);

      // Se releen para devolver los ids que acaba de crear la base: `createMany`
      // no los devuelve.
      const detalles = await this.salesRepository.detallesDeVenta(venta.id, db);

      return aRespuestaVentaCompleta(
        venta,
        { total: centimosATexto(total), lineas: detalles.length },
        detalles,
      );
    });
  }
}
