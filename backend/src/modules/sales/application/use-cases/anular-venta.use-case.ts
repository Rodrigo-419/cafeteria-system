import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  exigirAccesoSucursal,
  type ActorVentas,
} from '../../domain/rules/alcance-ventas';
import { mismoDiaLocal } from '../../domain/rules/fechas';
import { SalesRepository } from '../../infrastructure/sales.repository';
import {
  aRespuestaVentaCompleta,
  totalesDeLineas,
  type VentaCompletaRespuesta,
} from '../venta-respuesta';

/**
 * Caso de uso: anular una venta.
 *
 * Anular no borra: cambia el estado y deja quien, cuando y por que. Es lo que
 * convierte la venta en inmutable de cara al cliente (no hay PUT ni DELETE) y lo
 * que permite reconstruir la caja de un dia con las anulaciones incluidas.
 *
 * Tres condiciones, en este orden:
 *
 *   1. La venta existe y esta en el alcance del actor (404).
 *   2. Esta completada (409): una venta ya anulada no se anula dos veces.
 *   3. Fue del mismo dia local (409). La caja de ayer ya esta cerrada; corregir
 *      esa venta deberia ser otra operacion, con otro control, no un boton.
 *
 * `ahora` se recibe por parametro para que la regla del mismo dia sea
 * comprobable sin depender del reloj del sistema.
 */
@Injectable()
export class AnularVentaUseCase {
  constructor(private readonly salesRepository: SalesRepository) {}

  async ejecutar(
    actor: ActorVentas,
    ventaId: string,
    motivo: string,
    ahora: Date = new Date(),
  ): Promise<VentaCompletaRespuesta> {
    const motivoLimpio = motivo.trim();

    if (motivoLimpio === '') {
      throw new BadRequestException({
        message: 'El motivo de la anulacion no puede estar vacio',
      });
    }

    return this.salesRepository.enTransaccion(async (db) => {
      const completa = await this.salesRepository.buscarVentaCompleta(
        ventaId,
        db,
      );

      if (completa === null) {
        throw new NotFoundException('La venta no existe');
      }

      exigirAccesoSucursal(actor, completa.venta.sucursalId, 'La venta no existe');

      if (completa.venta.estado !== 'completada') {
        throw new ConflictException('La venta ya esta anulada');
      }

      if (!mismoDiaLocal(completa.venta.createdAt, ahora)) {
        throw new ConflictException(
          'Solo se pueden anular ventas del mismo dia',
        );
      }

      const anulada = await this.salesRepository.anularVenta(
        ventaId,
        {
          fechaAnulacion: ahora,
          usuarioAnuladorId: actor.id,
          motivoAnulacion: motivoLimpio,
        },
        db,
      );

      if (anulada === null) {
        // Otra peticion gano la carrera entre la lectura y la escritura.
        throw new ConflictException('La venta ya no esta completada');
      }

      return aRespuestaVentaCompleta(
        anulada,
        totalesDeLineas(completa.detalles),
        completa.detalles,
      );
    });
  }
}
