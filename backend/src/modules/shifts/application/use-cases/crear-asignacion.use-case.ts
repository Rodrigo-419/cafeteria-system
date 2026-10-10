// Caso de uso: asignar un turno a un empleado.
//
// Empleado y turno tienen que ser de la misma sucursal, y se resuelven cada uno
// con su alcance para que un Gerente no pueda tocar los de otra sucursal (eso
// responde 404, no 403).
//
// El solapamiento se comprueba dentro de una transaccion que bloquea la fila del
// empleado con `SELECT ... FOR UPDATE`. Sin ese bloqueo, dos altas simultaneas
// para el mismo empleado leerian las dos que no hay solapamiento y las dos
// insertarian; con el, se serializan y la segunda ve la primera.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { filtroAlcanceEmpleados } from '../../../employees/domain/rules/alcance';
import { EmployeesRepository } from '../../../employees/infrastructure/employees.repository';
import { diaUtc, fechaIsoDe } from '../../domain/fechas';
import {
  filtroAlcanceTurnos,
  type ActorTurnos,
} from '../../domain/rules/alcance';
import {
  haySolapamiento,
  type AsignacionHorario,
} from '../../domain/rules/solapamiento';
import {
  ShiftsRepository,
  type AsignacionRespuesta,
} from '../../infrastructure/shifts.repository';

export type EntradaCrearAsignacion = {
  empleadoId: string;
  turnoId: string;
  fechaInicio: string;
  fechaFin?: string;
};

@Injectable()
export class CrearAsignacionUseCase {
  constructor(
    private readonly shiftsRepository: ShiftsRepository,
    private readonly employeesRepository: EmployeesRepository,
  ) {}

  async ejecutar(
    actor: ActorTurnos,
    entrada: EntradaCrearAsignacion,
  ): Promise<AsignacionRespuesta> {
    const empleado = await this.employeesRepository.buscarAlcanceEnAlcance(
      entrada.empleadoId,
      filtroAlcanceEmpleados(actor),
    );

    if (!empleado) {
      throw new NotFoundException('Empleado no encontrado');
    }

    const turno = await this.shiftsRepository.buscarTurnoEnAlcance(
      entrada.turnoId,
      filtroAlcanceTurnos(actor),
    );

    if (!turno) {
      throw new NotFoundException('Turno no encontrado');
    }

    if (turno.sucursalId !== empleado.sucursalId) {
      throw new NotFoundException(
        'El turno no pertenece a la sucursal del empleado',
      );
    }

    if (empleado.estado !== 'activo') {
      throw new ConflictException(
        'El empleado esta cesado y no se le pueden asignar turnos',
      );
    }

    const fechaInicio = diaUtc(entrada.fechaInicio);
    const fechaFin = entrada.fechaFin === undefined ? null : diaUtc(entrada.fechaFin);

    if (fechaInicio < empleado.fechaContratacion) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser anterior a la contratacion del empleado',
      );
    }

    if (fechaFin !== null && fechaFin < fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la de inicio',
      );
    }

    return this.shiftsRepository.enTransaccion(async (cliente) => {
      await this.shiftsRepository.bloquearEmpleado(empleado.id, cliente);

      const existentes = await this.shiftsRepository.listarAsignacionesPorEmpleado(
        empleado.id,
        undefined,
        cliente,
      );

      const candidata: AsignacionHorario = {
        fechaInicio: entrada.fechaInicio,
        fechaFin: entrada.fechaFin ?? null,
        turno: {
          tipo: turno.tipo,
          horaInicio: turno.horaInicio,
          horaFin: turno.horaFin,
          diasSemana: turno.diasSemana,
        },
      };

      const otras: AsignacionHorario[] = existentes.map((asignacion) => ({
        fechaInicio: fechaIsoDe(asignacion.fechaInicio),
        fechaFin:
          asignacion.fechaFin === null ? null : fechaIsoDe(asignacion.fechaFin),
        turno: asignacion.turno,
      }));

      if (haySolapamiento(candidata, otras)) {
        throw new ConflictException(
          'El empleado ya tiene una asignacion que se solapa',
        );
      }

      return this.shiftsRepository.crearAsignacion(
        {
          empleadoId: empleado.id,
          turnoId: turno.id,
          fechaInicio,
          fechaFin,
        },
        cliente,
      );
    });
  }
}
