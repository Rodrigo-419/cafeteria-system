// Caso de uso: marcar entrada o salida en el terminal.
//
// La hora es SIEMPRE la del servidor: el cliente no puede fijar cuando ocurre
// la marcacion. El PIN se compara contra el hash bcrypt del empleado (o contra
// un hash falso si no tiene PIN, para que el tiempo no delate que no existe).
// Los fallos de PIN se cuentan en `RegistroFallosPinService`; con cinco dentro
// de la ventana cualquier marcacion (aunque el PIN sea correcto) responde 429.
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { $Enums } from '../../../../generated/prisma/client';
import { RONDAS_BCRYPT } from '../../../users/application/use-cases/crear-usuario.use-case';
import {
  tieneSucursalAsistencia,
  type ActorAsistencia,
} from '../../domain/rules/alcance';
import { fechaLocalDe } from '../../domain/fechas';
import { problemaMarcaje } from '../../domain/rules/marcaje';
import { derivarAsistencia } from '../../domain/rules/registros-efectivos';
import {
  AttendanceRepository,
  type EmpleadoDeMarcacion,
  type RegistroRespuesta,
} from '../../infrastructure/attendance.repository';
import { RegistroFallosPinService } from '../registro-fallos-pin.service';

/**
 * Hash de un PIN que no es de nadie.
 *
 * Cuando el empleado no tiene PIN se compara contra este hash en vez de fallar
 * antes de comparar: asi un atacante no distingue por el tiempo entre "no hay
 * PIN" y "PIN incorrecto".
 */
const HASH_PIN_FANTASMA = bcrypt.hashSync('000000', RONDAS_BCRYPT);

export type TipoMarcaje = $Enums.RegistroAsistenciaTipo;

export type MarcarAsistenciaComando = {
  empleadoId: string;
  tipo: TipoMarcaje;
  pin: string;
};

@Injectable()
export class MarcarAsistenciaUseCase {
  constructor(
    private readonly repository: AttendanceRepository,
    private readonly registroFallosPin: RegistroFallosPinService,
  ) {}

  async ejecutar(
    actor: ActorAsistencia,
    comando: MarcarAsistenciaComando,
  ): Promise<RegistroRespuesta> {
    if (!tieneSucursalAsistencia(actor)) {
      throw new ForbiddenException(
        'Tu cuenta no tiene una sucursal asignada para marcar asistencia',
      );
    }

    return this.repository.enTransaccion(async (cliente) => {
      await this.repository.bloquearEmpleado(comando.empleadoId, cliente);

      const empleado = await this.repository.buscarEmpleadoDeSucursal(
        comando.empleadoId,
        actor.sucursalId as string,
        cliente,
      );
      if (empleado === null) {
        throw new NotFoundException('Empleado no encontrado');
      }
      if (empleado.estado !== 'activo') {
        throw new NotFoundException('Empleado no encontrado');
      }

      const ahora = new Date();

      if (this.registroFallosPin.estaBloqueado(comando.empleadoId, ahora)) {
        throw new HttpException(
          'Demasiados intentos de PIN. Espera un minuto e intentalo de nuevo',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const pinValido = await compararPin(empleado, comando.pin);
      if (!pinValido) {
        this.registroFallosPin.registrarFallo(comando.empleadoId, ahora);
        throw new ForbiddenException('PIN incorrecto');
      }

      const historial = await this.repository.listarRegistrosDeEmpleado(
        comando.empleadoId,
        cliente,
      );
      const derivacion = derivarAsistencia(historial);
      const diaLocalAhora = fechaLocalDe(ahora);

      const problema = problemaMarcaje(
        comando.tipo,
        diaLocalAhora,
        derivacion.entradasAbiertas.map((evento) => ({
          diaLocal: fechaLocalDe(evento.fechaHora),
        })),
      );
      if (problema !== null) {
        throw new ConflictException(problema);
      }

      return this.repository.crearRegistro(
        {
          empleadoId: empleado.id,
          sucursalId: empleado.sucursalId,
          tipo: comando.tipo,
          fechaHora: ahora,
          metodo: 'pin',
          esCorreccion: false,
        },
        cliente,
      );
    });
  }
}

/**
 * Compara el PIN contra el hash del empleado, o contra el hash fantasma si no
 * tiene PIN.
 */
async function compararPin(
  empleado: EmpleadoDeMarcacion,
  pin: string,
): Promise<boolean> {
  const hash = empleado.pinHash ?? HASH_PIN_FANTASMA;
  return bcrypt.compare(pin, hash);
}