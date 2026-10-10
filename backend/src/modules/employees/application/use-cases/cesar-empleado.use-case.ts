// Caso de uso: cesar a un empleado.
//
// Cesas es una baja, no un borrado: el empleado queda `inactivo` y conserva su
// historico, y ademas hay que bloquear la cuenta de usuario vinculada. Ambas
// cosas ocurren en la misma transaccion: si el bloqueo falla, el cese no se
// aplica, y al reves.
//
// El bloqueo pasa por el caso de uso de users para no saltarse sus invariantes
// (por ejemplo, no dejar el sistema sin ningun Admin activo).
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CambiarEstadoUseCase } from '../../../users/application/use-cases/cambiar-estado.use-case';
import { diaUtc, fechaLocalDe } from '../../domain/fechas';
import {
  filtroAlcanceEmpleados,
  type ActorEmpleados,
} from '../../domain/rules/alcance';
import { empleadoYaCesado, problemasFechaCese } from '../../domain/rules/cese';
import {
  EmployeesRepository,
  type EmpleadoRespuesta,
} from '../../infrastructure/employees.repository';

@Injectable()
export class CesarEmpleadoUseCase {
  constructor(
    private readonly employeesRepository: EmployeesRepository,
    private readonly cambiarEstado: CambiarEstadoUseCase,
  ) {}

  async ejecutar(
    actor: ActorEmpleados,
    id: string,
    entrada: { fechaCese?: string },
  ): Promise<EmpleadoRespuesta> {
    const empleado = await this.employeesRepository.buscarAlcanceEnAlcance(
      id,
      filtroAlcanceEmpleados(actor),
    );

    if (!empleado) {
      throw new NotFoundException('Empleado no encontrado');
    }

    if (empleadoYaCesado(empleado.estado)) {
      throw new ConflictException('El empleado ya esta cesado');
    }

    const fechaCese = diaUtc(entrada.fechaCese ?? fechaLocalDe(new Date()));
    const problemas = problemasFechaCese(empleado.fechaContratacion, fechaCese);

    if (problemas.length > 0) {
      throw new BadRequestException({
        message: 'La fecha de cese no es valida',
        problemas,
      });
    }

    return this.employeesRepository.enTransaccion(async (cliente) => {
      await this.cambiarEstado.ejecutar(
        actor,
        empleado.usuarioId,
        'bloqueado',
        cliente,
      );

      const cesado = await this.employeesRepository.marcarCese(
        id,
        fechaCese,
        cliente,
      );

      if (!cesado) {
        // Otra peticion ceso al empleado entre la lectura y la escritura.
        throw new ConflictException('El empleado ya esta cesado');
      }

      return cesado;
    });
  }
}
