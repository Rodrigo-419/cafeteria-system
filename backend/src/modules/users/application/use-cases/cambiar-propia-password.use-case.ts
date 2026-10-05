// Caso de uso: cambiar la propia contrasena.
//
// Solo requiere estar autenticado, pero exige la contrasena actual para
// confirmar que la sesion sigue siendo de quien dice ser.
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { validarPassword } from '../../../auth/domain/rules/password-policy';
import { Actor } from '../../domain/rules/alcance';
import { UsersRepository } from '../../infrastructure/users.repository';
import { RONDAS_BCRYPT } from './crear-usuario.use-case';

@Injectable()
export class CambiarPropiaPasswordUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async ejecutar(
    actor: Actor,
    passwordActual: string,
    passwordNueva: string,
  ): Promise<void> {
    // Necesitamos el hash almacenado, asi que se pide por separado: el usuario
    // siempre existe (viene de request.user) y es el propio, no hay alcance que
    // comprobar. `buscarPorIdEnAlcance` ya no transporta el hash.
    const objetivo = await this.usersRepository.buscarHashPorId(actor.id);

    if (!objetivo) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const actualCoincide = await bcrypt.compare(
      passwordActual,
      objetivo.passwordHash,
    );

    if (!actualCoincide) {
      throw new BadRequestException('La contrasena actual no es correcta');
    }

    const problemas = validarPassword(passwordNueva);
    if (problemas.length > 0) {
      throw new BadRequestException({
        message: 'La contrasena no cumple la politica de seguridad',
        problemas,
      });
    }

    const passwordHash = await bcrypt.hash(passwordNueva, RONDAS_BCRYPT);
    await this.usersRepository.actualizarPassword(actor.id, passwordHash);
  }
}