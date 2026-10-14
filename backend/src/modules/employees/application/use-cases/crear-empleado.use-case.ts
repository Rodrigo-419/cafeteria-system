// Caso de uso: registrar un empleado a partir de un usuario existente.
//
// El usuario vinculado lo resuelve el repositorio de users con su propio filtro
// de alcance: un Gerente solo alcanza usuarios con rol Empleado de su sucursal,
// de modo que intentar vincular a un usuario de otra sucursal responde 404 y no
// revela que existe. El alta y su evento de auditoria van en la misma
// transaccion.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditoriaRepository } from '../../../auditoria/infrastructure/auditoria.repository';
import { filtroAlcanceListado } from '../../../users/domain/rules/alcance';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { diaUtc } from '../../domain/fechas';
import {
  type ActorEmpleados,
} from '../../domain/rules/alcance';
import { problemasVinculoEmpleado } from '../../domain/rules/vinculo-usuario';
import {
  EmployeesRepository,
  type EmpleadoRespuesta,
} from '../../infrastructure/employees.repository';

export type EntradaCrearEmpleado = {
  usuarioId: string;
  cargo: string;
  fechaContratacion: string;
  sucursalId?: string | null;
};

@Injectable()
export class CrearEmpleadoUseCase {
  constructor(
    private readonly employeesRepository: EmployeesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  async ejecutar(
    actor: ActorEmpleados,
    entrada: EntradaCrearEmpleado,
  ): Promise<EmpleadoRespuesta> {
    return this.employeesRepository.enTransaccion(async (cliente) => {
      const usuario = await this.usersRepository.buscarPorIdEnAlcance(
        entrada.usuarioId,
        filtroAlcanceListado(actor),
        cliente,
      );

      if (!usuario) {
        throw new NotFoundException(
          'El usuario no existe o esta fuera de tu alcance',
        );
      }

      // El empleado hereda la sucursal del usuario. Si el alta pide una distinta,
      // el vinculo es invalido.
      const problemas = problemasVinculoEmpleado({
        rolUsuario: usuario.rol,
        sucursalUsuario: usuario.sucursalId,
        sucursalEmpleado: entrada.sucursalId ?? null,
      });

      if (problemas.length > 0) {
        throw new BadRequestException({
          message: 'El usuario no puede vincularse a un empleado',
          problemas,
        });
      }

      if (usuario.sucursalId === null) {
        // Cubierto por `problemasVinculoEmpleado`; se comprueba para el tipo.
        throw new BadRequestException('El usuario debe tener una sucursal asignada');
      }

      if (
        await this.employeesRepository.usuarioYaEsEmpleado(
          usuario.id,
          undefined,
          cliente,
        )
      ) {
        throw new ConflictException(
          'El usuario ya esta registrado como empleado',
        );
      }

      const empleado = await this.employeesRepository.crearEmpleado(
        {
          usuarioId: usuario.id,
          cargo: entrada.cargo.trim(),
          sucursalId: usuario.sucursalId,
          fechaContratacion: diaUtc(entrada.fechaContratacion),
        },
        cliente,
      );

      await this.auditoria.registrar(
        {
          entidad: 'empleado',
          entidadId: empleado.id,
          accion: 'empleado_creado',
          actorId: actor.id,
          usuarioAfectadoId: empleado.usuarioId,
          sucursalAfectadaId: empleado.sucursalId,
          detalle: {
            despues: {
              cargo: empleado.cargo,
              sucursalId: empleado.sucursalId,
              fechaContratacion: empleado.fechaContratacion,
            },
          },
        },
        cliente,
      );

      return empleado;
    });
  }
}
