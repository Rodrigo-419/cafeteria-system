// Caso de uso: restablecer la contrasena de un usuario dentro del alcance.
//
// El orden de las comprobaciones es el de siempre: primero el alcance (404) y
// despues la politica de contrasena (400), para no revelar que el usuario
// existe. Todo ocurre dentro de la misma transaccion que la auditoria.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuditoriaRepository } from '../../../auditoria/infrastructure/auditoria.repository';
import { validarPassword } from '../../../auth/domain/rules/password-policy';
import { Actor, filtroAlcanceListado } from '../../domain/rules/alcance';
import { UsersRepository } from '../../infrastructure/users.repository';
import { RONDAS_BCRYPT } from './crear-usuario.use-case';

@Injectable()
export class RestablecerPasswordUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  async ejecutar(actor: Actor, id: string, password: string): Promise<void> {
    const alcance = filtroAlcanceListado(actor);

    await this.usersRepository.enTransaccion(async (cliente) => {
      const objetivo = await this.usersRepository.buscarPorIdEnAlcance(
        id,
        alcance,
        cliente,
      );

      if (!objetivo) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const problemas = validarPassword(password);
      if (problemas.length > 0) {
        throw new BadRequestException({
          message: 'La contrasena no cumple la politica de seguridad',
          problemas,
        });
      }

      const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);
      await this.usersRepository.actualizarPassword(id, passwordHash, cliente);

      // El detalle NO lleva la contrasena ni el hash.
      await this.auditoria.registrar(
        {
          entidad: 'usuario',
          entidadId: id,
          accion: 'usuario_password_restablecida',
          actorId: actor.id,
          usuarioAfectadoId: id,
          sucursalAfectadaId: objetivo.sucursalId,
          detalle: {},
        },
        cliente,
      );
    });
  }
}
