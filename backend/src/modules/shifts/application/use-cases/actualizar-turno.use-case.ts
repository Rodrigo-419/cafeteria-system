// Caso de uso: editar un turno.
//
// Solo se pueden cambiar las horas y los dias: el tipo y la sucursal quedan
// fijos tras el alta. Ademas, si el cambio dejara a un empleado con dos
// asignaciones solapadas, se rechaza con 409 en vez de dejar los datos en un
// estado que la propia API no habria permitido crear.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fechaIsoDe } from '../../domain/fechas';
import {
  filtroAlcanceTurnos,
  type ActorTurnos,
} from '../../domain/rules/alcance';
import { problemasHorarioTurno } from '../../domain/rules/horario';
import {
  haySolapamiento,
  type AsignacionHorario,
  type HorarioTurno,
} from '../../domain/rules/solapamiento';
import {
  ShiftsRepository,
  type TurnoRespuesta,
} from '../../infrastructure/shifts.repository';
import { normalizarDiasSemana, normalizarHora } from '../normalizacion-turno';

export type EntradaActualizarTurno = {
  horaInicio?: string;
  horaFin?: string;
  diasSemana?: string;
};

@Injectable()
export class ActualizarTurnoUseCase {
  constructor(private readonly shiftsRepository: ShiftsRepository) {}

  async ejecutar(
    actor: ActorTurnos,
    id: string,
    entrada: EntradaActualizarTurno,
  ): Promise<TurnoRespuesta> {
    const turno = await this.shiftsRepository.buscarTurnoEnAlcance(
      id,
      filtroAlcanceTurnos(actor),
    );

    if (!turno) {
      throw new NotFoundException('Turno no encontrado');
    }

    if (
      entrada.horaInicio === undefined &&
      entrada.horaFin === undefined &&
      entrada.diasSemana === undefined
    ) {
      throw new BadRequestException('No hay cambios que aplicar al turno');
    }

    // Se combina lo que llega con lo que ya tenia el turno y se valida el
    // resultado completo: cambiar solo una hora no puede saltarse la regla de
    // que la de fin sea posterior a la de inicio.
    const horaInicio =
      entrada.horaInicio === undefined
        ? turno.horaInicio
        : normalizarHora(entrada.horaInicio);
    const horaFin =
      entrada.horaFin === undefined ? turno.horaFin : normalizarHora(entrada.horaFin);

    const problemasHorario = problemasHorarioTurno({
      tipo: turno.tipo,
      horaInicio,
      horaFin,
    });
    if (problemasHorario.length > 0) {
      throw new BadRequestException({
        message: 'El horario del turno no es valido',
        problemas: problemasHorario,
      });
    }

    const diasSemana =
      entrada.diasSemana === undefined
        ? turno.diasSemana
        : normalizarDiasSemana(entrada.diasSemana, turno.tipo);

    const nuevoHorario: HorarioTurno = {
      tipo: turno.tipo,
      horaInicio,
      horaFin,
      diasSemana,
    };

    return this.shiftsRepository.enTransaccion(async (cliente) => {
      const asignaciones = await this.shiftsRepository.listarAsignacionesDeTurno(
        id,
        cliente,
      );

      for (const asignacion of asignaciones) {
        const otras = await this.shiftsRepository.listarAsignacionesPorEmpleado(
          asignacion.empleadoId,
          asignacion.id,
          cliente,
        );

        const candidata: AsignacionHorario = {
          fechaInicio: fechaIsoDe(asignacion.fechaInicio),
          fechaFin:
            asignacion.fechaFin === null ? null : fechaIsoDe(asignacion.fechaFin),
          turno: nuevoHorario,
        };

        const existentes: AsignacionHorario[] = otras.map((otra) => ({
          fechaInicio: fechaIsoDe(otra.fechaInicio),
          fechaFin: otra.fechaFin === null ? null : fechaIsoDe(otra.fechaFin),
          turno: otra.turno,
        }));

        if (haySolapamiento(candidata, existentes)) {
          throw new ConflictException(
            'El cambio dejaria asignaciones solapadas del mismo empleado',
          );
        }
      }

      return this.shiftsRepository.actualizarTurno(
        id,
        { horaInicio, horaFin, diasSemana },
        cliente,
      );
    });
  }
}
