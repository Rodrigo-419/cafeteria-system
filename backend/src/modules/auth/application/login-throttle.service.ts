// Control de intentos fallidos de inicio de sesion.
//
// A diferencia del throttler generico (que cuenta TODAS las peticiones), aqui
// solo cuentan los intentos FALLIDOS: un login correcto nunca consume cupo. El
// objetivo es frenar la fuerza bruta sin castigar el uso legitimo (varias
// personas que comparten la IP de una sucursal, o cambiar de cuenta varias
// veces seguidas).
//
// Se usan dos contadores con ventana fija de un minuto, todo EN MEMORIA:
//
//   * (usuario normalizado + IP): 5 fallos -> se bloquea ese par. El login
//     correcto reinicia este contador.
//   * IP: 20 fallos -> se bloquea la IP completa, para que no se pueda probar
//     una contrasena contra muchos usuarios distintos desde el mismo origen.
//
// El contador usa el usuario ENVIADO, exista o no: un usuario inexistente y una
// contrasena incorrecta cuentan igual y producen las mismas respuestas, de modo
// que no se puede enumerar cuentas por el comportamiento del limite.
//
// LIMITACION CONOCIDA: al vivir en memoria, el estado se pierde al reiniciar el
// servidor y no se comparte entre varias instancias. Es aceptable para esta
// cafeteria (una sola instancia); si se escalara en horizontal habria que mover
// estos contadores a un almacen compartido (Redis).
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { normalizarNombreUsuario } from '../domain/rules/nombre-usuario';

/** Token del reloj inyectable; permite simular el paso del tiempo en pruebas. */
export const RELOJ_LOGIN = 'RELOJ_LOGIN';

/** Funcion que devuelve la marca de tiempo actual en milisegundos. */
export type Reloj = () => number;

/** Fallos permitidos por par (usuario, IP) antes de bloquear. */
export const MAX_FALLOS_POR_USUARIO_IP = 5;

/** Fallos permitidos por IP antes de bloquear cualquier usuario desde ella. */
export const MAX_FALLOS_POR_IP = 20;

/** Duracion de la ventana fija, en milisegundos. */
export const VENTANA_INTENTOS_MS = 60_000;

/** Cada cuanto se purgan las entradas vencidas, en milisegundos. */
const INTERVALO_LIMPIEZA_MS = 5 * 60_000;

interface EntradaIntentos {
  fallos: number;
  /** Marca de tiempo (ms) en la que vence la ventana actual. */
  venceEn: number;
}

@Injectable()
export class LoginThrottleService implements OnModuleDestroy {
  private readonly porUsuarioIp = new Map<string, EntradaIntentos>();
  private readonly porIp = new Map<string, EntradaIntentos>();
  private readonly temporizador: NodeJS.Timeout;

  constructor(@Inject(RELOJ_LOGIN) private readonly reloj: Reloj) {
    this.temporizador = setInterval(
      () => this.limpiarVencidas(this.reloj()),
      INTERVALO_LIMPIEZA_MS,
    );
    // No se quiere que un temporizador de limpieza mantenga vivo el proceso.
    this.temporizador.unref?.();
  }

  onModuleDestroy(): void {
    clearInterval(this.temporizador);
  }

  /**
   * Segundos que debe esperar el cliente si el par (usuario, IP) o la IP ya
   * estan bloqueados; `null` si la peticion puede continuar hacia el login.
   */
  verificar(nombreUsuario: string, ip: string): number | null {
    const ahora = this.reloj();
    const usuario = normalizarNombreUsuario(nombreUsuario);

    const delUsuario = this.entradaVigente(
      this.porUsuarioIp,
      claveUsuario(usuario, ip),
      ahora,
    );
    if (delUsuario && delUsuario.fallos >= MAX_FALLOS_POR_USUARIO_IP) {
      return segundosHasta(delUsuario.venceEn, ahora);
    }

    const deLaIp = this.entradaVigente(this.porIp, ip, ahora);
    if (deLaIp && deLaIp.fallos >= MAX_FALLOS_POR_IP) {
      return segundosHasta(deLaIp.venceEn, ahora);
    }

    return null;
  }

  /** Registra un intento fallido en los dos contadores. */
  registrarFallo(nombreUsuario: string, ip: string): void {
    const ahora = this.reloj();
    const usuario = normalizarNombreUsuario(nombreUsuario);
    this.sumar(this.porUsuarioIp, claveUsuario(usuario, ip), ahora);
    this.sumar(this.porIp, ip, ahora);
  }

  /**
   * Reinicia el contador del par (usuario, IP) tras un login correcto. El tope
   * por IP NO se reinicia: si lo hiciera, un atacante podria probar muchas
   * cuentas e intercalar un acceso valido para borrar su propio contador.
   */
  registrarExito(nombreUsuario: string, ip: string): void {
    const usuario = normalizarNombreUsuario(nombreUsuario);
    this.porUsuarioIp.delete(claveUsuario(usuario, ip));
  }

  /** Purga las entradas cuya ventana ya vencio. */
  limpiarVencidas(ahora: number): void {
    for (const [clave, entrada] of this.porUsuarioIp) {
      if (entrada.venceEn <= ahora) {
        this.porUsuarioIp.delete(clave);
      }
    }
    for (const [clave, entrada] of this.porIp) {
      if (entrada.venceEn <= ahora) {
        this.porIp.delete(clave);
      }
    }
  }

  private sumar(
    mapa: Map<string, EntradaIntentos>,
    clave: string,
    ahora: number,
  ): void {
    const actual = mapa.get(clave);
    if (!actual || actual.venceEn <= ahora) {
      mapa.set(clave, { fallos: 1, venceEn: ahora + VENTANA_INTENTOS_MS });
      return;
    }
    actual.fallos += 1;
  }

  private entradaVigente(
    mapa: Map<string, EntradaIntentos>,
    clave: string,
    ahora: number,
  ): EntradaIntentos | null {
    const entrada = mapa.get(clave);
    if (!entrada) {
      return null;
    }
    if (entrada.venceEn <= ahora) {
      mapa.delete(clave);
      return null;
    }
    return entrada;
  }
}

function claveUsuario(usuario: string, ip: string): string {
  return `${usuario}|${ip}`;
}

function segundosHasta(venceEn: number, ahora: number): number {
  return Math.max(1, Math.ceil((venceEn - ahora) / 1000));
}
