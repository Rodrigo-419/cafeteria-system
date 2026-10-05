// Caso de uso: obtener un usuario por id, respetando el alcance del actor.
// Fuera de alcance responde 404 para no revelar que el usuario existe.
import { Injectable, NotFoundException } from '@nestjs/common';
import { Actor, filtroAlcanceListado } from '../../domain/rules/alcance';
import {
  UsuarioRespuesta,
  UsersRepository,
} from '../../infrastructure/users.repository';

@Injectable()
export class ObtenerUsuarioUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async ejecutar(actor: Actor, id: string): Promise<UsuarioRespuesta> {
    const usuario = await this.usersRepository.buscarRespuestaEnAlcance(
      id,
      filtroAlcanceListado(actor),
    );

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }
}