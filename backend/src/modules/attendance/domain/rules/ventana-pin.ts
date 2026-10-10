// Regla de dominio: ventana de fallos del PIN de marcacion.
//
// Un PIN es solo 6 digitos, asi que sin limite de intentos seria trivial probarlo
// por fuerza bruta. La proteccion es una ventana FIJA de un minuto por empleado:
// en ella solo se cuentan los fallos; con cinco, cualquier marcacion (incluso con
// el PIN correcto) se rechaza con 429 hasta que la ventana termina. Un acierto
// no cuenta. La regla es pura: la memoria viva esta en `RegistroFallosPin`, que
// guarda el estado por empleado y delega en estas funciones.
//
// Limitaciones conocidas (documentadas en decisiones-de-diseno): la ventana vive
// en memoria del servidor, asi que se pierde al reiniciar y no se comparte entre
// instancias; por eso es una medida complementaria y no la unica capa del sistema.

export const VENTANA_FALLOS_PIN_MS = 60_000;
export const MAXIMO_FALLOS_PIN = 5;

export type EstadoIntentosPin = {
  /** Fallos dentro de la ventana actual. */
  fallos: number;
  /** Inicio de la ventana, o null si no hay fallos recientes. */
  inicioVentanaMs: number | null;
};

/** Estado inicial de un empleado sin fallos recientes. */
export function estadoInicialIntentosPin(): EstadoIntentosPin {
  return { fallos: 0, inicioVentanaMs: null };
}

/** true si hay una ventana en curso en el instante dado. */
export function ventanaVigente(
  estado: EstadoIntentosPin,
  ahora: Date,
  ventanaMs: number = VENTANA_FALLOS_PIN_MS,
): boolean {
  return (
    estado.inicioVentanaMs !== null &&
    ahora.getTime() - estado.inicioVentanaMs < ventanaMs
  );
}

/**
 * true si el empleado esta bloqueado para marcar. La ventana caduca sola,
 * aunque el contador de fallos siga en el estado hasta el siguiente intento.
 */
export function estaBloqueadoPorPin(
  estado: EstadoIntentosPin,
  ahora: Date,
  maximoFallos: number = MAXIMO_FALLOS_PIN,
  ventanaMs: number = VENTANA_FALLOS_PIN_MS,
): boolean {
  return (
    estado.fallos >= maximoFallos && ventanaVigente(estado, ahora, ventanaMs)
  );
}

/**
 * Registra un fallo. Si la ventana anterior caduco, abre una nueva con este
 * fallo como el primero.
 */
export function registrarFalloPin(
  estado: EstadoIntentosPin,
  ahora: Date,
  ventanaMs: number = VENTANA_FALLOS_PIN_MS,
): EstadoIntentosPin {
  if (!ventanaVigente(estado, ahora, ventanaMs)) {
    return { fallos: 1, inicioVentanaMs: ahora.getTime() };
  }

  return {
    fallos: estado.fallos + 1,
    inicioVentanaMs: estado.inicioVentanaMs,
  };
}