import {
  estadoInicialIntentosPin,
  estaBloqueadoPorPin,
  MAXIMO_FALLOS_PIN,
  registrarFalloPin,
  VENTANA_FALLOS_PIN_MS,
} from './ventana-pin';

describe('ventana de fallos del PIN', () => {
  const t0 = new Date('2026-10-10T12:00:00.000Z');

  it('parte sin fallos y sin bloqueo', () => {
    const estado = estadoInicialIntentosPin();
    expect(estado.fallos).toBe(0);
    expect(estaBloqueadoPorPin(estado, t0)).toBe(false);
  });

  it('acumula fallos en una misma ventana', () => {
    let estado = estadoInicialIntentosPin();
    estado = registrarFalloPin(estado, t0);
    estado = registrarFalloPin(estado, new Date(t0.getTime() + 1_000));

    expect(estado.fallos).toBe(2);
    expect(estado.inicioVentanaMs).toBe(t0.getTime());
  });

  it('bloquea al llegar a cinco fallos y sigue bloqueado con PIN correcto', () => {
    let estado = estadoInicialIntentosPin();
    for (let i = 0; i < MAXIMO_FALLOS_PIN; i += 1) {
      estado = registrarFalloPin(estado, new Date(t0.getTime() + i * 1_000));
    }

    expect(estado.fallos).toBe(MAXIMO_FALLOS_PIN);
    expect(estaBloqueadoPorPin(estado, new Date(t0.getTime() + 30_000))).toBe(true);
  });

  it('desbloquea cuando termina la ventana', () => {
    let estado = estadoInicialIntentosPin();
    for (let i = 0; i < MAXIMO_FALLOS_PIN; i += 1) {
      estado = registrarFalloPin(estado, new Date(t0.getTime() + i * 1_000));
    }

    const trasVentana = new Date(t0.getTime() + VENTANA_FALLOS_PIN_MS + 1);
    expect(estaBloqueadoPorPin(estado, trasVentana)).toBe(false);
  });

  it('un fallo despues de la ventana abre una ventana nueva', () => {
    let estado = estadoInicialIntentosPin();
    estado = registrarFalloPin(estado, t0);
    estado = registrarFalloPin(
      estado,
      new Date(t0.getTime() + VENTANA_FALLOS_PIN_MS + 1),
    );

    expect(estado.fallos).toBe(1);
    expect(estado.inicioVentanaMs).toBe(t0.getTime() + VENTANA_FALLOS_PIN_MS + 1);
  });

  it('no llega al bloqueo con menos de cinco fallos', () => {
    let estado = estadoInicialIntentosPin();
    for (let i = 0; i < 4; i += 1) {
      estado = registrarFalloPin(estado, new Date(t0.getTime() + i * 1_000));
    }

    expect(estaBloqueadoPorPin(estado, new Date(t0.getTime() + 10_000))).toBe(false);
  });
});