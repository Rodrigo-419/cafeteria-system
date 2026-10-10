// Caso de uso: obtener un empleado por id, respetando el alcance del actor.
// Fuera de alcance responde 404 para no revelar que el empleado existe.
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  filtroAlcanceEmpleados,
  type ActorEmpleados,
} from '../../domain/rules/alcance';
import {
  EmployeesRepository,
  type EmpleadoRespuesta,
} from '../../infrastructure/employees.repository';

@Injectable()
export class ObtenerEmpleadoUseCase {
  constructor(private readonly employeesRepository: EmployeesRepository) {}

  async ejecutar(
    actor: ActorEmpleados,
    id: string,
  ): Promise<EmpleadoRespuesta> {
    const empleado = await this.employeesRepository.buscarRespuestaEnAlcance(
      id,
      filtroAlcanceEmpleados(actor),
    );

    if (!empleado) {
      throw new NotFoundException('Empleado no encontrado');
    }

    return empleado;
  }
}
