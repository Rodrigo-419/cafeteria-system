import { Injectable } from '@nestjs/common';
import { pagina, type Paginado } from '../paginado';
import {
  exigirAccesoSucursal,
  filtroSucursalAlcance,
  type ActorInventario,
} from '../../domain/rules/alcance-inventario';
import {
  ESTADOS_ALERTA_STOCK,
  type EstadoAlertaStock,
} from '../../domain/rules/estados-insumo';
import { exigirSucursalExistente } from '../exigir-sucursal';
import {
  InventoryRepository,
  type AlertaConContextoFila,
 } from '../../infrastructure/inventory.repository';

export type EntradaListarAlertas = {
  page: number;
  limit: number;
  sucursalId?: string;
  estado?: string;
};

export type PaginaAlertas = Paginado<AlertaConContextoFila>;

/**
 * Caso de uso: listar alertas de stock.
 *
 * Cada alerta trae el insumo y el stock en el momento de consultarla, para poder
 * mostrarla sin pedir una segunda llamada.
 *
 * No hay endpoint para resolver una alerta a mano: se abre y se cierra sola,
 * cuando el stock o el estado cambian. El que consulta decide que hacer con ella,
 * pero la decision de abrirla o cerrarla la toma el sistema en su transaccion.
 */
@Injectable()
export class ListarAlertasUseCase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async ejecutar(
    actor: ActorInventario,
    entrada: EntradaListarAlertas,
  ): Promise<PaginaAlertas> {
    const sucursalId = filtroSucursalAlcance(actor, entrada.sucursalId);

    if (sucursalId !== undefined) {
      exigirAccesoSucursal(actor, sucursalId);
      await exigirSucursalExistente(this.inventoryRepository, sucursalId);
    }

    // Un estado que no es valido se ignora en vez de convertirse en un filtro
    // imposible que siempre sale vacio. El DTO ya lo rechaza, pero el caso de uso
    // no debe depender de que siempre venga por HTTP.
    const estado =
      entrada.estado !== undefined &&
      (ESTADOS_ALERTA_STOCK as readonly string[]).includes(entrada.estado)
        ? (entrada.estado as EstadoAlertaStock)
        : undefined;

    const filtros = {
      page: entrada.page,
      limit: entrada.limit,
      ...(sucursalId !== undefined ? { sucursalId } : {}),
      ...(estado !== undefined ? { estado } : {}),
    };

    const data = await this.inventoryRepository.listarAlertas(filtros);
    const total = await this.inventoryRepository.contarAlertas(filtros);

    return pagina(data, total, entrada.page, entrada.limit);
  }
}
