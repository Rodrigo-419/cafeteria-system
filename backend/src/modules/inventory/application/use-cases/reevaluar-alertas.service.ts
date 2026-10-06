// Servicio de aplicacion: reevalua la alerta de un insumo tras un cambio.
//
// No es un endpoint, sino el paso que todos los flujos capable de mover el stock
// comparten: configurar el minimo, cambiar el estado, registrar una entrada y
// contar. Los cuatro terminan igual, asi que la decision vive aqui una sola vez.
//
// Dos garantias:
//
//   1. Se ejecuta con el cliente de la transaccion del flujo que lo llama. Si se
//      leyera fuera, una entrada podria resolver una alerta que aun no se ha
//      creado, o dejar abierta una que el recuento ya ha resuelto.
//   2. Solo abre alerta si no hay ninguna abierta. El indice unico parcial de la
//      base lo impide de todos modos, y perder esa carrera no es un fallo: la
//      alerta abierta es la correcta, y la habria abierto el otro proceso. Por
//      eso la insercion va con `skipDuplicates` en vez de confiar en atrapar
//      `P2002`, que en PostgreSQL abortaria la transaccion del flujo que llama.
import { Injectable } from '@nestjs/common';
import { evaluarAlerta, type EstadoInsumoSucursal } from '../../domain/rules/alertas';
import {
  InventoryRepository,
  type ClienteInventario,
 } from '../../infrastructure/inventory.repository';

@Injectable()
export class ReevaluarAlertasService {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  /**
   * Abre y/o cierra la alerta del insumo indicado segun su estado actual.
   *
   * @param insumoSucursalId fila de `insumo_sucursal` que ha cambiado.
   * @param cliente cliente de la transaccion del flujo; obligatorio, porque
   * evaluar fuera de ella leeria un estado que todavia no esta guardado.
   */
  async ejecutar(
    insumoSucursalId: string,
    cliente: ClienteInventario,
  ): Promise<void> {
    // Se relee la fila dentro de la transaccion: el valor que paso el flujo
    // puede ser anterior a otros cambios de la misma transaccion.
    const fila = await this.inventoryRepository.buscarStockPorId(
      insumoSucursalId,
      cliente,
    );

    if (!fila) {
      return;
    }

    const abierta = await this.inventoryRepository.alertaAbierta(
      insumoSucursalId,
      cliente,
    );

    const decision = evaluarAlerta({
      estado: fila.estado as EstadoInsumoSucursal,
      stockActual: fila.stockActual,
      stockMinimo: fila.stockMinimo,
      hayAlertaAbierta: abierta !== null,
    });

    if (decision.abrir) {
      await this.inventoryRepository.abrirAlerta(insumoSucursalId, cliente);
    }

    if (decision.resolver) {
      await this.inventoryRepository.resolverAlerta(insumoSucursalId, cliente);
    }
  }
}
