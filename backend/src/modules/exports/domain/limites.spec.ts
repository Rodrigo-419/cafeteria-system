import {
  MAX_FILAS_POR_CONJUNTO,
  MAX_FILAS_TOTALES,
  MAX_DIAS_RANGO,
  FILAS_POR_LOTE,
  exigeRango,
  validarRangoExport,
} from './limites';

describe('limites domain', () => {
  it('constants are correct', () => {
    expect(MAX_FILAS_POR_CONJUNTO).toBe(20_000);
    expect(MAX_FILAS_TOTALES).toBe(50_000);
    expect(MAX_DIAS_RANGO).toBe(92);
    expect(FILAS_POR_LOTE).toBe(1_000);
  });

  it('exigeRango returns true for activity sets', () => {
    expect(exigeRango('ventas')).toBe(true);
    expect(exigeRango('movimientos')).toBe(true);
    expect(exigeRango('asistencia')).toBe(true);
    expect(exigeRango('faltas')).toBe(true);
    expect(exigeRango('reporte')).toBe(true);
    expect(exigeRango('carta')).toBe(false);
    expect(exigeRango('stock')).toBe(false);
    expect(exigeRango('empleados')).toBe(false);
  });

  it('validarRangoExport rejects missing range for activity sets', () => {
    expect(() => validarRangoExport('ventas', {})).toThrow();
    expect(() => validarRangoExport('ventas', { desde: '2026-01-01' })).toThrow();
    expect(() => validarRangoExport('ventas', { hasta: '2026-01-01' })).toThrow();
  });

  it('validarRangoExport rejects inverted range', () => {
    expect(() => validarRangoExport('ventas', { desde: '2026-01-10', hasta: '2026-01-01' })).toThrow();
  });

  it('validarRangoExport rejects range > 92 days', () => {
    expect(() => validarRangoExport('ventas', { desde: '2026-01-01', hasta: '2026-04-05' })).toThrow();
  });

  it('validarRangoExport accepts valid range <= 92 days', () => {
    expect(() => validarRangoExport('ventas', { desde: '2026-01-01', hasta: '2026-03-31' })).not.toThrow();
    expect(() => validarRangoExport('ventas', { desde: '2026-01-01', hasta: '2026-04-02' })).not.toThrow(); // 92 days
  });

  it('validarRangoExport allows missing range for non-activity sets', () => {
    expect(() => validarRangoExport('carta', {})).not.toThrow();
    expect(() => validarRangoExport('empleados', { desde: '2026-01-01' })).not.toThrow();
  });
});
