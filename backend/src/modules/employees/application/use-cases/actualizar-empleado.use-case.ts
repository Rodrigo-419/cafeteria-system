// Caso de uso: editar un empleado. Tras el alta solo se puede cambiar el cargo:
// la sucursal viene del usuario, y la fecha de contratacion y la de cese son
// datos historicos que no se reescriben.
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
export class ActualizarEmpleadoUseCase {
  constructor(private readonly employeesRepository: EmployeesRepository) {}

  async ejecutar(
    actor: ActorEmpleados,
    id: string,
    entrada: { cargo: string },
  ): Promise<EmpleadoRespuesta> {
    const empleado = await this.employeesRepository.buscarAlcanceEnAlcance(
      id,
      filtroAlcanceEmpleados(actor),
    );

    if (!empleado) {
      throw new NotFoundException('Empleado no encontrado');
    }

    return this.employeesRepository.actualizarCargo(id, entrada.cargo.trim());
  }
}
