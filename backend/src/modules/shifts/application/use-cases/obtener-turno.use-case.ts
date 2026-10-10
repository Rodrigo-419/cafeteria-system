// Caso de uso: obtener un turno por id dentro del alcance del actor.
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  filtroAlcanceTurnos,
  type ActorTurnos,
} from '../../domain/rules/alcance';
import {
  ShiftsRepository,
  type TurnoRespuesta,
} from '../../infrastructure/shifts.repository';

@Injectable()
export class ObtenerTurnoUseCase {
  constructor(private readonly shiftsRepository: ShiftsRepository) {}

  async ejecutar(actor: ActorTurnos, id: string): Promise<TurnoRespuesta> {
    const turno = await this.shiftsRepository.buscarTurnoEnAlcance(
      id,
      filtroAlcanceTurnos(actor),
    );

    if (!turno) {
      throw new NotFoundException('Turno no encontrado');
    }

    return turno;
  }
}
