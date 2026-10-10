// Caso de uso: crear un turno.
//
// La sucursal no sale nunca del cuerpo cuando quien crea es un Gerente: se fuerza
// la suya aunque mande otra, para que no pueda crear turnos en otra sucursal. Un
// Admin si elige la sucursal y esta tiene que existir.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { $Enums } from '../../../../generated/prisma/client';
import { esAdmin, esGerente } from '../../../users/domain/roles';
import type { ActorTurnos } from '../../domain/rules/alcance';
import { problemasHorarioTurno } from '../../domain/rules/horario';
import {
  ShiftsRepository,
  type TurnoRespuesta,
} from '../../infrastructure/shifts.repository';
import { normalizarDiasSemana, normalizarHora } from '../normalizacion-turno';

export type EntradaCrearTurno = {
  sucursalId?: string;
  tipo: string;
  horaInicio?: string;
  horaFin?: string;
  diasSemana?: string;
};

@Injectable()
export class CrearTurnoUseCase {
  constructor(private readonly shiftsRepository: ShiftsRepository) {}

  async ejecutar(
    actor: ActorTurnos,
    entrada: EntradaCrearTurno,
  ): Promise<TurnoRespuesta> {
    const tipo = entrada.tipo as $Enums.TurnoTipo;
    const horaInicio = normalizarHora(entrada.horaInicio);
    const horaFin = normalizarHora(entrada.horaFin);

    const problemasHorario = problemasHorarioTurno({ tipo, horaInicio, horaFin });
    if (problemasHorario.length > 0) {
      throw new BadRequestException({
        message: 'El horario del turno no es valido',
        problemas: problemasHorario,
      });
    }

    const diasSemana = normalizarDiasSemana(entrada.diasSemana, tipo);
    const sucursalId = await this.resolverSucursal(actor, entrada.sucursalId);

    return this.shiftsRepository.crearTurno({
      sucursalId,
      tipo,
      horaInicio,
      horaFin,
      diasSemana,
    });
  }

  /** Sucursal del turno: la del Gerente, o la que elija y exista el Admin. */
  private async resolverSucursal(
    actor: ActorTurnos,
    sucursalId: string | undefined,
  ): Promise<string> {
    if (esGerente(actor.rol)) {
      if (actor.sucursalId === null) {
        throw new ForbiddenException('Tu cuenta no tiene una sucursal asignada');
      }
      return actor.sucursalId;
    }

    if (!esAdmin(actor.rol)) {
      throw new ForbiddenException('No puedes gestionar turnos');
    }

    if (sucursalId === undefined) {
      throw new BadRequestException('Debes indicar la sucursal del turno');
    }

    if (!(await this.shiftsRepository.existeSucursal(sucursalId))) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    return sucursalId;
  }
}
