import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  SIN_ALCANCE,
  filtroSucursalAlcance,
  type ActorVentas,
} from '../../domain/rules/alcance-ventas';
import { esEstadoVenta, esMetodoPagoVenta } from '../../domain/rules/estados-venta';
import { esFechaLocal, rangoDelDiaLocal } from '../../domain/rules/fechas';
import {
  SalesRepository,
  TOTALES_VACIOS,
  type FiltrosVentas,
} from '../../infrastructure/sales.repository';
import { pagina, type Paginado } from '../paginado';
import { aRespuestaVenta, type VentaRespuesta } from '../venta-respuesta';

export type EntradaListarVentas = {
  page: number;
  limit: number;
  sucursalId?: string;
  estado?: string;
  metodoPago?: string;
  /** Dia local `YYYY-MM-DD` sobre el que se filtra `createdAt`. */
  fecha?: string;
};

/**
 * Caso de uso: listar ventas con paginado y filtros.
 *
 * El alcance se comprueba antes de tocar la base. Un Gerente que pide la
 * sucursal de otro recibe 404 sin consulta alguna, y una sucursal que no esta
 * dada de alta recibe 404 tambien, en vez de un 200 vacio indistinguible de
 * "ese dia no hubo ventas".
 *
 * El filtro por fecha no es un filtro por rango de horas de la maquina: es el
 * dia del negocio en America/Lima. `2026-10-06` selecciona de 00:00 a 24:00
 * hora de Lima, que en UTC es de 05:00 del 6 a 05:00 del 7.
 */
@Injectable()
export class ListarVentasUseCase {
  constructor(private readonly salesRepository: SalesRepository) {}

  async ejecutar(
    actor: ActorVentas,
    entrada: EntradaListarVentas,
  ): Promise<Paginado<VentaRespuesta>> {
    const sucursalId = filtroSucursalAlcance(actor, entrada.sucursalId);

    if (
      sucursalId !== undefined &&
      sucursalId !== SIN_ALCANCE &&
      !(await this.salesRepository.existeSucursal(sucursalId))
    ) {
      throw new NotFoundException('La sucursal no existe');
    }

    // Un filtro que no es un estado o un metodo de pago valido se ignora en vez
    // de convertirse en un filtro imposible que siempre sale vacio. El DTO ya
    // lo rechaza, pero el caso de uso no debe depender de que siempre llegue
    // por HTTP. La fecha, en cambio, si se comprueba: ignorarla devolveria
    // TODAS las ventas a quien pidio un dia concreto.
    const estado =
      entrada.estado !== undefined && esEstadoVenta(entrada.estado)
        ? entrada.estado
        : undefined;

    const metodoPago =
      entrada.metodoPago !== undefined && esMetodoPagoVenta(entrada.metodoPago)
        ? entrada.metodoPago
        : undefined;

    const filtros: FiltrosVentas = {
      ...(sucursalId !== undefined ? { sucursalId } : {}),
      ...(estado !== undefined ? { estado } : {}),
      ...(metodoPago !== undefined ? { metodoPago } : {}),
      ...this.rangoDeFecha(entrada.fecha),
    };

    const filas = await this.salesRepository.listarVentas(
      filtros,
      entrada.page,
      entrada.limit,
    );
    const total = await this.salesRepository.contarVentas(filtros);

    const totales = await this.salesRepository.totalesDeVentas(
      filas.map((fila) => fila.id),
    );

    return pagina(
      filas.map((fila) =>
        aRespuestaVenta(fila, totales.get(fila.id) ?? TOTALES_VACIOS),
      ),
      total,
      entrada.page,
      entrada.limit,
    );
  }

  private rangoDeFecha(fecha: string | undefined): { desde: Date; hasta: Date } | undefined {
    if (fecha === undefined) {
      return undefined;
    }

    if (!esFechaLocal(fecha)) {
      throw new BadRequestException({
        message: 'La fecha debe ser un dia valido en formato YYYY-MM-DD',
      });
    }

    return rangoDelDiaLocal(fecha);
  }
}
