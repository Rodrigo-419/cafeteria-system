import { ETIQUETA_ENTIDAD_AUDITORIA, ETIQUETA_ACCION_AUDITORIA, VALORES_ENUM } from './etiquetas';
import { CONJUNTOS } from './limites';

describe('etiquetas domain', () => {
  it('ETIQUETA_ENTIDAD_AUDITORIA has all needed keys', () => {
    expect(ETIQUETA_ENTIDAD_AUDITORIA['exportacion']).toBeDefined();
    expect(typeof ETIQUETA_ENTIDAD_AUDITORIA['exportacion']).toBe('string');
  });

  it('ETIQUETA_ACCION_AUDITORIA has all needed keys', () => {
    expect(ETIQUETA_ACCION_AUDITORIA['exportacion_generada']).toBeDefined();
    expect(ETIQUETA_ACCION_AUDITORIA['exportacion_fallida']).toBeDefined();
  });

  it('VALORES_ENUM completeness against Prisma enums', () => {
    expect(VALORES_ENUM.AuditoriaEntidad).toContain('exportacion');
    expect(VALORES_ENUM.AuditoriaAccion).toContain('exportacion_generada');
    expect(VALORES_ENUM.AuditoriaAccion).toContain('exportacion_fallida');
  });
});
