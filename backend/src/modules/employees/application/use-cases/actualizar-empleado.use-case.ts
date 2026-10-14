// Caso de uso: editar un empleado. Tras el alta solo se puede cambiar el cargo:
// la sucursal viene del usuario, y la fecha de contratacion y la de cese son
// datos historicos que no se reescriben. La edicion y su evento de auditoria
// van en la misma transaccion; si el cargo no cambia de verdad, no hay evento.
import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaRepository } from '../../../auditoria/infrastructure/auditoria.repository';
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
  constructor(
    private readonly employeesRepository: EmployeesRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  async ejecutar(
    actor: ActorEmpleados,
    id: string,
    entrada: { cargo: string },
  ): Promise<EmpleadoRespuesta> {
    return this.employeesRepository.enTransaccion(async (cliente) => {
      const empleado = await this.employeesRepository.buscarAlcanceEnAlcance(
        id,
        filtroAlcanceEmpleados(actor),
        cliente,
      );

      if (!empleado) {
        throw new NotFoundException('Empleado no encontrado');
      }

      const cargo = entrada.cargo.trim();
      const actualizado = await this.employeesRepository.actualizarCargo(
        id,
        cargo,
        cliente,
      );

      if (cargo !== empleado.cargo) {
        await this.auditoria.registrar(
          {
            entidad: 'empleado',
            entidadId: id,
            accion: 'empleado_editado',
            actorId: actor.id,
            usuarioAfectadoId: empleado.usuarioId,
            sucursalAfectadaId: empleado.sucursalId,
            detalle: {
              antes: { cargo: empleado.cargo },
              despues: { cargo: actualizado.cargo },
            },
          },
          cliente,
        );
      }

      return actualizado;
    });
  }
}
