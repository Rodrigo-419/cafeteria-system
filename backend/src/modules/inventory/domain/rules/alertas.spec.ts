import { debeAvisar, debeAbrirAlerta, debeResolverAlerta, evaluarAlerta, esInsumoActivo, type SituacionAlerta } from './alertas';

/** Situación por defecto: activo, stock por debajo del mínimo, sin alerta. */
function situacion(over: Partial<SituacionAlerta> = {}): SituacionAlerta {
  return {
    estado: 'activo',
    stockActual: '5.00',
    stockMinimo: '10.00',
    hayAlertaAbierta: false,
    ...over,
  };
}

describe('reglas de alertas', () => {
  describe('esInsumoActivo', () => {
    it('es cierto solo para activo', () => {
      expect(esInsumoActivo('activo')).toBe(true);
      expect(esInsumoActivo('descontinuado')).toBe(false);
    });
  });

  describe('debeAvisar', () => {
    it('avisa cuando el stock iguala al minimo', () => {
      expect(debeAvisar(situacion({ stockActual: '10.00', stockMinimo: '10.00' }))).toBe(true);
    });

    it('avisa cuando el stock queda por debajo del minimo', () => {
      expect(debeAvisar(situacion({ stockActual: '0.00', stockMinimo: '10.00' }))).toBe(true);
    });

    it('no avisa cuando el stock supera el minimo', () => {
      expect(debeAvisar(situacion({ stockActual: '10.01', stockMinimo: '10.00' }))).toBe(false);
    });

    it('no le da significacion al estado del insumo', () => {
      expect(debeAvisar(situacion({ estado: 'descontinuado' }))).toBe(true);
    });

    it('compara con la precision de la columna', () => {
      expect(debeAvisar(situacion({ stockActual: '0.30', stockMinimo: '0.3' }))).toBe(true);
    });
  });

  describe('debeAbrirAlerta', () => {
    it('abre si esta activo, ha llegado al minimo y no hay alerta', () => {
      expect(debeAbrirAlerta(situacion())).toBe(true);
    });

    it('no abre si ya hay una alerta abierta', () => {
      expect(debeAbrirAlerta(situacion({ hayAlertaAbierta: true }))).toBe(false);
    });

    it('no abre si el stock supera el minimo', () => {
      expect(debeAbrirAlerta(situacion({ stockActual: '20.00' }))).toBe(false);
    });

    it('no abre para un insumo descontinuado, aunque su stock sea cero', () => {
      expect(debeAbrirAlerta(situacion({ estado: 'descontinuado' }))).toBe(false);
    });

    it('abre con stock minimo cero y stock cero, que es el caso de activar', () => {
      expect(debeAbrirAlerta(situacion({ stockActual: '0.00', stockMinimo: '0.00' }))).toBe(
        true,
      );
    });
  });

  describe('debeResolverAlerta', () => {
    it('resuelve si hay alerta abierta y el stock supera el minimo', () => {
      expect(debeResolverAlerta(situacion({ hayAlertaAbierta: true, stockActual: '11.00' }))).toBe(
        true,
      );
    });

    it('resuelve si hay alerta abierta y el insumo se descontinua', () => {
      expect(
        debeResolverAlerta(
          situacion({ hayAlertaAbierta: true, estado: 'descontinuado', stockActual: '50.00' }),
        ),
      ).toBe(true);
    });

    it('NO resuelve si el stock sigue en el minimo exacto', () => {
      expect(
        debeResolverAlerta(situacion({ hayAlertaAbierta: true, stockActual: '10.00' })),
      ).toBe(false);
    });

    it('NO resuelve si el stock esta por debajo del minimo', () => {
      expect(
        debeResolverAlerta(situacion({ hayAlertaAbierta: true, stockActual: '9.99' })),
      ).toBe(false);
    });

    it('no hace nada si no hay alerta abierta que resolver', () => {
      expect(debeResolverAlerta(situacion({ stockActual: '99.00' }))).toBe(false);
      expect(
        debeResolverAlerta(situacion({ hayAlertaAbierta: false, estado: 'descontinuado' })),
      ).toBe(false);
    });
  });

  describe('evaluarAlerta', () => {
    it('abrir y resolver nunca son ciertos a la vez', () => {
      const casos: SituacionAlerta[] = [
        situacion(),
        situacion({ hayAlertaAbierta: true }),
        situacion({ stockActual: '20.00' }),
        situacion({ hayAlertaAbierta: true, stockActual: '20.00' }),
        situacion({ estado: 'descontinuado' }),
        situacion({ estado: 'descontinuado', hayAlertaAbierta: true }),
      ];

      for (const caso of casos) {
        const decision = evaluarAlerta(caso);

        expect(decision.abrir && decision.resolver).toBe(false);
      }
    });

    it('abre una alerta nueva con el stock en el minimo', () => {
      expect(evaluarAlerta(situacion())).toEqual({ abrir: true, resolver: false });
    });

    it('deja la alerta como estaba si el stock sigue por debajo', () => {
      expect(evaluarAlerta(situacion({ hayAlertaAbierta: true }))).toEqual({
        abrir: false,
        resolver: false,
      });
    });

    it('cierra la alerta cuando la entrada deja el stock por encima', () => {
      // El recorrido del enunciado: minimo 10, se abre con 0, una entrada de 5
      // la deja abierta y una entrada de 10 la resuelve.
      const trasActivar = evaluarAlerta(
        situacion({ stockActual: '0.00', stockMinimo: '10.00' }),
      );
      expect(trasActivar).toEqual({ abrir: true, resolver: false });

      const trasEntrada5 = evaluarAlerta(
        situacion({ stockActual: '5.00', stockMinimo: '10.00', hayAlertaAbierta: true }),
      );
      expect(trasEntrada5).toEqual({ abrir: false, resolver: false });

      const trasEntrada10 = evaluarAlerta(
        situacion({ stockActual: '15.00', stockMinimo: '10.00', hayAlertaAbierta: true }),
      );
      expect(trasEntrada10).toEqual({ abrir: false, resolver: true });
    });

    it('cierra la alerta al descontinuar, tenga el stock que tenga', () => {
      expect(
        evaluarAlerta(
          situacion({ estado: 'descontinuado', hayAlertaAbierta: true, stockActual: '99.00' }),
        ),
      ).toEqual({ abrir: false, resolver: true });
    });

    it('no abre ni al descontinuar un insumo que aun no tenia alerta', () => {
      expect(evaluarAlerta(situacion({ estado: 'descontinuado' }))).toEqual({
        abrir: false,
        resolver: false,
      });
    });
  });
});
