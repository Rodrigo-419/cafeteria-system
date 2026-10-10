// Caso de uso: pantalla de marcacion del terminal.
//
// Devuelve solo los empleados ACTIVOS de la sucursal del actor y solo nombre e
// id: el terminal no necesita cargo, fecha de contratacion ni otros datos. Un
// actor sin sucursal (Admin) no puede marcar y este listado tampoco le aplica.
import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { tieneSucursalAsistencia, type ActorAsistencia } from '../../domain/rules/alcance';
import {
  AttendanceRepository,
  type EmpleadoNombre,
} from '../../infrastructure/attendance.repository';

@Injectable()
export class ListarEmpleadosTerminalUseCase {
  constructor(private readonly repository: AttendanceRepository) {}

  async ejecutar(actor: ActorAsistencia): Promise<EmpleadoNombre[]> {
    if (!tieneSucursalAsistencia(actor)) {
      throw new ForbiddenException(
        'Tu cuenta no tiene una sucursal asignada para marcar asistencia',
      );
    }

    return this.repository.listarEmpleadosActivosDeSucursal(
      actor.sucursalId as string,
    );
  }
}