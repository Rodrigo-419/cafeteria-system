// Caso de uso: restablecer la contrasena de un usuario dentro del alcance.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { validarPassword } from '../../../auth/domain/rules/password-policy';
import { Actor, filtroAlcanceListado } from '../../domain/rules/alcance';
import { UsersRepository } from '../../infrastructure/users.repository';
import { RONDAS_BCRYPT } from './crear-usuario.use-case';

@Injectable()
export class RestablecerPasswordUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async ejecutar(actor: Actor, id: string, password: string): Promise<void> {
    const alcance = filtroAlcanceListado(actor);
    const objetivo = await this.usersRepository.buscarPorIdEnAlcance(id, alcance);

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
    await this.usersRepository.actualizarPassword(id, passwordHash);
  }
}