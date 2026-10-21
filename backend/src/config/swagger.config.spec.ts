// Pruebas de la decision de publicar Swagger.
import { debeHabilitarDocumentacion } from './swagger.config';

describe('debeHabilitarDocumentacion', () => {
  it('no publica la documentacion en produccion', () => {
    expect(debeHabilitarDocumentacion('production')).toBe(false);
  });

  it('la publica en desarrollo, pruebas y si NODE_ENV esta vacio', () => {
    expect(debeHabilitarDocumentacion('development')).toBe(true);
    expect(debeHabilitarDocumentacion('test')).toBe(true);
    expect(debeHabilitarDocumentacion(undefined)).toBe(true);
  });

  it('solo la desactiva con el valor exacto "production"', () => {
    expect(debeHabilitarDocumentacion('Production')).toBe(true);
    expect(debeHabilitarDocumentacion('prod')).toBe(true);
  });
});
