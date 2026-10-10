// Caso de uso: retirar una asignacion fijandole fecha de fin.
//
// No hay DELETE: retirar es cerrar la vigencia. La fecha de fin no puede quedar
// antes del inicio ni antes de hoy en el calendario del negocio, para que no se
// pueda cerrar una asignacion "en el pasado" por error.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { diaUtc, fechaLocalDe } from '../../domain/fechas';
import {
  alcanceEmpleadosParaAsignaciones,
  type ActorTurnos,
} from '../../domain/rules/alcance';
import {
  ShiftsRepository,
  type AsignacionRespuesta,
} from '../../infrastructure/shifts.repository';

@Injectable()
export class RetirarAsignacionUseCase {
  constructor(private readonly shiftsRepository: ShiftsRepository) {}

  async ejecutar(
    actor: ActorTurnos,
    id: string,
    entrada: { fechaFin: string },
  ): Promise<AsignacionRespuesta> {
    const asignacion = await this.shiftsRepository.buscarAsignacionAlcance(
      id,
      alcanceEmpleadosParaAsignaciones(actor),
    );

    if (!asignacion) {
      throw new NotFoundException('Asignacion no encontrada');
    }

    const fechaFin = diaUtc(entrada.fechaFin);

    if (fechaFin < asignacion.fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la de inicio',
      );
    }

    if (fechaFin < diaUtc(fechaLocalDe(new Date()))) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a hoy',
      );
    }

    return this.shiftsRepository.retirarAsignacion(id, fechaFin);
  }
}
