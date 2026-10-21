// Caso de uso: obtener el horario del empleado vinculado al usuario autenticado.
//
// Resuelve el empleado desde el userId del token (no lo pide el cliente),
// carga sus asignaciones con el horario de cada turno y devuelve un día por
// entrada del rango. Sin registro de empleado → 404. Sin asignaciones → días
// con turno null.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthRepository } from '../../../auth/infrastructure/auth.repository';
import { BranchesRepository } from '../../../branches/branches.repository';
import { EmployeesRepository } from '../../../employees/infrastructure/employees.repository';
import { ShiftsRepository } from '../../../shifts/infrastructure/shifts.repository';
import {
  AsignacionHorario,
  TurnoHorario,
  diasDelRango,
  turnoParaDia,
  validarRango,
} from '../../domain/reglas-mi-horario';

export interface DiaHorario {
  fecha: string;
  turno: TurnoHorario | null;
}

export interface EmpleadoHorario {
  nombre: string;
  cargo: string;
  sucursal: string;
}

export interface HorarioEmpleado {
  empleado: EmpleadoHorario;
  dias: DiaHorario[];
}

@Injectable()
export class MiHorarioUseCase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly employeesRepository: EmployeesRepository,
    private readonly shiftsRepository: ShiftsRepository,
    private readonly branchesRepository: BranchesRepository,
  ) {}

  async ejecutar(
    usuarioId: string,
    rango: { desde?: string; hasta?: string },
  ): Promise<HorarioEmpleado> {
    // Las reglas puras lanzan `Error`; se traducen a 400 aquí, en la capa de
    // aplicación, para que un rango inválido no sea un 500.
    let desde: string;
    let hasta: string;
    try {
      const rangoValidado = validarRango(rango.desde, rango.hasta);
      desde = rangoValidado.desde;
      hasta = rangoValidado.hasta;
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(mensaje);
    }

    const empleado = await this.buscarEmpleadoDelUsuario(usuarioId);
    if (empleado === null) {
      throw new NotFoundException(
        'No estás vinculado a un empleado. Contacta al administrador.',
      );
    }

    const asignaciones =
      await this.shiftsRepository.listarAsignacionesPorEmpleado(empleado.id);
    const conTurno = asignaciones.map((asignacion) => ({
      id: asignacion.id,
      fechaInicio: asignacion.fechaInicio.toISOString().slice(0, 10),
      fechaFin: asignacion.fechaFin
        ? asignacion.fechaFin.toISOString().slice(0, 10)
        : null,
      turno: {
        tipo: asignacion.turno.tipo,
        horaInicio: asignacion.turno.horaInicio,
        horaFin: asignacion.turno.horaFin,
        diasSemana: asignacion.turno.diasSemana,
      },
    }));

    const sucursal = await this.branchesRepository.buscarPorId(empleado.sucursalId);
    const fechaCeseTexto = empleado.fechaCese
      ? empleado.fechaCese.toISOString().slice(0, 10)
      : null;

    const dias = diasDelRango(desde, hasta).map((fecha) => ({
      fecha,
      turno: turnoParaDia(fecha, conTurno, fechaCeseTexto),
    }));

    return {
      empleado: {
        nombre: empleado.usuario.nombre,
        cargo: empleado.cargo,
        sucursal: sucursal?.nombre ?? 'Sin sucursal',
      },
      dias,
    };
  }

  /**
   * Empleado vinculado al usuario autenticado, sin filtrar por alcance (es el
   * propio usuario). Devuelve null si no hay vínculo.
   */
  private async buscarEmpleadoDelUsuario(usuarioId: string) {
    const usuario = await this.authRepository.obtenerUsuarioActivoPorId(usuarioId);
    if (usuario === null) {
      return null;
    }
    return this.employeesRepository.buscarRespuestaPorUsuarioId(usuarioId);
  }
}
