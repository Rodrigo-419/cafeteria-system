import { Injectable, NotFoundException } from '@nestjs/common';
import {
  exigirAccesoSucursal,
  type ActorVentas,
} from '../../domain/rules/alcance-ventas';
import { SalesRepository } from '../../infrastructure/sales.repository';
import {
  aRespuestaVentaCompleta,
  totalesDeLineas,
  type VentaCompletaRespuesta,
} from '../venta-respuesta';

/**
 * Caso de uso: ver una venta con sus lineas.
 *
 * Una venta inexistente y una venta de otra sucursal responden lo mismo: 404
 * con el mismo mensaje. Un 403 confirmaria que ese identificador existe.
 */
@Injectable()
export class ObtenerVentaUseCase {
  constructor(private readonly salesRepository: SalesRepository) {}

  async ejecutar(
    actor: ActorVentas,
    ventaId: string,
  ): Promise<VentaCompletaRespuesta> {
    const completa = await this.salesRepository.buscarVentaCompleta(ventaId);

    if (completa === null) {
      throw new NotFoundException('La venta no existe');
    }

    exigirAccesoSucursal(actor, completa.venta.sucursalId, 'La venta no existe');

    return aRespuestaVentaCompleta(
      completa.venta,
      totalesDeLineas(completa.detalles),
      completa.detalles,
    );
  }
}
