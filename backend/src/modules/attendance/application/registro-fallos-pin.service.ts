// Estado vivo de la ventana de fallos del PIN.
//
// La regla pura (`domain/rules/ventana-pin`) no sabe de empleados ni guarda
// nada; esta clase es la memoria por empleado que la alimenta. Vive en el
// proceso del servidor: se documenta en decisiones-de-diseno que se reinicia al
// reiniciar y no se comparte entre instancias.
import { Injectable } from '@nestjs/common';
import {
  estadoInicialIntentosPin,
  estaBloqueadoPorPin,
  registrarFalloPin,
  type EstadoIntentosPin,
} from '../domain/rules/ventana-pin';

@Injectable()
export class RegistroFallosPinService {
  private readonly intentos = new Map<string, EstadoIntentosPin>();

  /** true si el empleado acumulo el maximo de fallos dentro de la ventana. */
  estaBloqueado(empleadoId: string, ahora: Date = new Date()): boolean {
    return estaBloqueadoPorPin(
      this.intentos.get(empleadoId) ?? estadoInicialIntentosPin(),
      ahora,
    );
  }

  /** Suma un fallo a la ventana del empleado. */
  registrarFallo(empleadoId: string, ahora: Date = new Date()): void {
    const actual =
      this.intentos.get(empleadoId) ?? estadoInicialIntentosPin();
    this.intentos.set(empleadoId, registrarFalloPin(actual, ahora));
  }
}