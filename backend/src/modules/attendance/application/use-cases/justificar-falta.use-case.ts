// Caso de uso: justificar una falta de un empleado.
//
// Una justificacion cubre UN dia y queda en `justificacion_falta` con el usuario
// que la hizo. No se puede justificar un dia que ya tiene entrada efectiva (no
// es una falta), un dia futuro ni un dia anterior a la contratacion. Solo
// corrigen los Gerentes (permiso `asistencia.corregir`).
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { diaUtc, fechaLocalDe } from '../../domain/fechas';
import { filtroAlcanceAsistencia, type ActorAsistencia } from '../../domain/rules/alcance';
import { derivarAsistencia, REGISTRO_ENTRADA } from '../../domain/rules/registros-efectivos';
import {
  AttendanceRepository,
  type JustificacionRespuesta,
} from '../../infrastructure/attendance.repository';

export type JustificarFaltaComando = {
  empleadoId: string;
  fecha: string;
  motivo: string;
};

@Injectable()
export class JustificarFaltaUseCase {
  constructor(private readonly repository: AttendanceRepository) {}

  async ejecutar(
    actor: ActorAsistencia,
    comando: JustificarFaltaComando,
  ): Promise<JustificacionRespuesta> {
    const alcance = filtroAlcanceAsistencia(actor);
    const empleados = await this.repository.listarEmpleadosDeAlcance(alcance, {
      empleadoId: comando.empleadoId,
    });

    const empleado = empleados.find((item) => item.id === comando.empleadoId);
    if (empleado === undefined) {
      throw new NotFoundException('Empleado no encontrado');
    }

    const hoy = fechaLocalDe(new Date());
    if (comando.fecha > hoy) {
      throw new BadRequestException('La fecha de la justificacion no puede ser futura');
    }

    if (diaUtc(comando.fecha).getTime() < empleado.fechaContratacion.getTime()) {
      throw new BadRequestException(
        'La fecha no puede ser anterior a la contratacion del empleado',
      );
    }

    const historial = await this.repository.listarRegistrosDeEmpleado(
      comando.empleadoId,
    );
    const derivacion = derivarAsistencia(historial);
    const tieneEntradaEfectiva = derivacion.registros.some(
      (registro) =>
        registro.tipo === REGISTRO_ENTRADA &&
        fechaLocalDe(registro.fechaHora) === comando.fecha,
    );
    if (tieneEntradaEfectiva) {
      throw new ConflictException('Ese dia ya tiene una entrada registrada');
    }

    const creada = await this.repository.crearJustificacion({
      empleadoId: comando.empleadoId,
      fecha: diaUtc(comando.fecha),
      motivo: comando.motivo,
      usuarioJustificadorId: actor.id,
    });

    if (creada === null) {
      throw new ConflictException('Ese dia ya esta justificado');
    }

    return creada;
  }
}