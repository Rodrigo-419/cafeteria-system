import { empleadoYaCesado, problemasFechaCese } from './cese';

describe('cese', () => {
  it('reconoce a un empleado ya cesado', () => {
    expect(empleadoYaCesado('inactivo')).toBe(true);
    expect(empleadoYaCesado('activo')).toBe(false);
  });

  it('acepta una fecha de cese igual a la de contratacion', () => {
    const dia = new Date('2026-01-15T00:00:00.000Z');

    expect(problemasFechaCese(dia, dia)).toEqual([]);
  });

  it('acepta una fecha de cese posterior', () => {
    expect(
      problemasFechaCese(
        new Date('2026-01-15T00:00:00.000Z'),
        new Date('2026-02-01T00:00:00.000Z'),
      ),
    ).toEqual([]);
  });

  it('rechaza una fecha de cese anterior a la de contratacion', () => {
    const problemas = problemasFechaCese(
      new Date('2026-01-15T00:00:00.000Z'),
      new Date('2026-01-14T00:00:00.000Z'),
    );

    expect(problemas).toContain(
      'La fecha de cese no puede ser anterior a la de contratacion',
    );
  });
});
