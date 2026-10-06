import {
  ESTADOS_VENTA,
  METODOS_PAGO_VENTA,
  esEstadoVenta,
  esMetodoPagoVenta,
  esOfertaVentaActiva,
} from './estados-venta';

describe('estados y metodos de pago', () => {
  it('acepta los metodos de pago del negocio', () => {
    expect(esMetodoPagoVenta('efectivo')).toBe(true);
    expect(esMetodoPagoVenta('tarjeta')).toBe(true);
  });

  it('rechaza cualquier otro metodo', () => {
    expect(esMetodoPagoVenta('bizum')).toBe(false);
    expect(esMetodoPagoVenta('EFECTIVO')).toBe(false);
    expect(esMetodoPagoVenta('')).toBe(false);
    expect(esMetodoPagoVenta(null)).toBe(false);
    expect(esMetodoPagoVenta(1)).toBe(false);
  });

  it('acepta los estados de venta', () => {
    expect(esEstadoVenta('completada')).toBe(true);
    expect(esEstadoVenta('anulada')).toBe(true);
    expect(esEstadoVenta('cancelada')).toBe(false);
    expect(esEstadoVenta(undefined)).toBe(false);
  });

  it('solo se vende sobre una oferta activa', () => {
    expect(esOfertaVentaActiva('activo')).toBe(true);
    expect(esOfertaVentaActiva('inactivo')).toBe(false);
    expect(esOfertaVentaActiva(undefined)).toBe(false);
  });

  it('los listados de dominio y los de la API son los mismos', () => {
    expect([...METODOS_PAGO_VENTA]).toEqual(['efectivo', 'tarjeta']);
    expect([...ESTADOS_VENTA]).toEqual(['completada', 'anulada']);
  });
});
