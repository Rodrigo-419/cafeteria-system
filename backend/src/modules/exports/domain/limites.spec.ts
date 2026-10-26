import {
  MAX_FILAS_POR_CONJUNTO,
  MAX_FILAS_TOTALES,
  MAX_DIAS_RANGO,
  FILAS_POR_LOTE,
  LIMITES_EXPORT_POR_DEFECTO,
  exigeRango,
  limitesDesdeEntorno,
  validarRangoExport,
} from './limites';

describe('limites domain', () => {
  it('constants are correct', () => {
    expect(MAX_FILAS_POR_CONJUNTO).toBe(10_000);
    expect(MAX_FILAS_TOTALES).toBe(20_000);
    expect(MAX_DIAS_RANGO).toBe(92);
    expect(FILAS_POR_LOTE).toBe(1_000);
  });

  it('los valores por defecto mantienen una sola exportacion global', () => {
    expect(LIMITES_EXPORT_POR_DEFECTO.maxFilasPorConjunto).toBe(10_000);
    expect(LIMITES_EXPORT_POR_DEFECTO.maxFilasTotales).toBe(20_000);
    expect(LIMITES_EXPORT_POR_DEFECTO.maxConcurrentesPorUsuario).toBe(1);
    expect(LIMITES_EXPORT_POR_DEFECTO.maxConcurrentesGlobales).toBe(1);
  });

  it('limitesDesdeEntorno usa los valores por defecto si no hay variables', () => {
    expect(limitesDesdeEntorno({})).toMatchObject({
      maxFilasPorConjunto: 10_000,
      maxFilasTotales: 20_000,
      maxConcurrentesPorUsuario: 1,
      maxConcurrentesGlobales: 1,
      maxPorMinuto: 10,
    });
  });

  it('limitesDesdeEntorno permite cambiar los dos topes de filas', () => {
    expect(
      limitesDesdeEntorno({
        EXPORT_MAX_FILAS_POR_CONJUNTO: '2500',
        EXPORT_MAX_FILAS_TOTALES: '4000',
      }),
    ).toMatchObject({
      maxFilasPorConjunto: 2_500,
      maxFilasTotales: 4_000,
    });
  });

  it('limitesDesdeEntorno rechaza un tope invalido sin arrancar', () => {
    expect(() =>
      limitesDesdeEntorno({ EXPORT_MAX_FILAS_POR_CONJUNTO: '0' }),
    ).toThrow(/EXPORT_MAX_FILAS_POR_CONJUNTO/);
    expect(() =>
      limitesDesdeEntorno({ EXPORT_MAX_FILAS_TOTALES: 'dos mil' }),
    ).toThrow(/EXPORT_MAX_FILAS_TOTALES/);
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

  it('el error de rango explica como acotar', () => {
    expect(() =>
      validarRangoExport('ventas', {
        desde: '2026-01-01',
        hasta: '2026-04-05',
      }),
    ).toThrow(/Acota el rango de fechas\./);
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
