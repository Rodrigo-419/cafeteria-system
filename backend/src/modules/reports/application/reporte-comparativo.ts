// Tipos de la respuesta del reporte comparativo entre sucursales.
//
// Se distingue el DIA del negocio del estado actual: las cifras de ventas,
// movimientos de inventario y faltas son del periodo pedido, mientras que las
// alertas abiertas y las entradas sin cerrar son el estado en el momento de
// generar el reporte. Esa diferencia es parte del contrato y viaja en un objeto
// `estadoActual` aparte para que no se confunda con las cifras del periodo.

export type VentasMetodoResumen = {
  /** Importe en texto con dos decimales. */
  total: string;
  cantidad: number;
};

export type ReporteVentas = {
  /** Importe total del periodo, en texto con dos decimales. */
  total: string;
  cantidad: number;
  /** `null` cuando no hubo ventas en el periodo. */
  ticketPromedio: string | null;
  porMetodoPago: {
    efectivo: VentasMetodoResumen;
    tarjeta: VentasMetodoResumen;
  };
  anuladas: {
    cantidad: number;
  };
};

export type ReporteMovimientos = {
  /** Conteo total de movimientos (entradas y ajustes). */
  total: number;
  entradas: { cantidad: number; cantidadNeta: string };
  ajustes: { cantidad: number; cantidadNeta: string };
};

export type ReporteInventario = {
  movimientos: ReporteMovimientos;
};

export type ReporteAsistencia = {
  faltas: number;
  faltasJustificadas: number;
};

export type ReporteEstadoActual = {
  insumosConAlertaAbierta: number;
  entradasAbiertas: number;
};

export type ReporteSucursal = {
  sucursalId: string;
  sucursalNombre: string;
  ventas: ReporteVentas;
  inventario: ReporteInventario;
  asistencia: ReporteAsistencia;
  estadoActual: ReporteEstadoActual;
};

export type ReporteComparativo = {
  desde: string;
  hasta: string;
  /** Instante ISO en el que se genero el reporte. */
  generadoEn: string;
  sucursales: ReporteSucursal[];
};
