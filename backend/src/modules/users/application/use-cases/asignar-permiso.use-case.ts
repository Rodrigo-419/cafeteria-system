// Caso de uso: conceder o revocar un permiso individual de un usuario.
//
// Reglas: el actor debe poseer el permiso entre sus permisos efectivos; a un
// Empleado solo se le conceden cuatro permisos concretos; la revocacion solo
// aplica a permisos que el rol del objetivo tiene por defecto; nadie cambia
// sus propios permisos. Fuera de alcance responde 404.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Actor, filtroAlcanceListado } from '../../domain/rules/alcance';
import { puedeModificarSusPropiosPermisos } from '../../domain/rules/reglas-rol-sucursal';
import { validarAsignacionPermiso } from '../../domain/rules/reglas-permisos';
import { UsersRepository } from '../../infrastructure/users.repository';

@Injectable()
export class AsignarPermisoUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async ejecutar(
    actor: Actor,
    usuarioId: string,
    permisoId: string,
    tipo: 'concedido' | 'revocado',
  ): Promise<void> {
    const alcance = filtroAlcanceListado(actor);
    const objetivo = await this.usersRepository.buscarPorIdEnAlcance(
      usuarioId,
      alcance,
    );

    if (!objetivo) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!puedeModificarSusPropiosPermisos(actor.id, usuarioId)) {
      throw new BadRequestException('No puedes cambiar tus propios permisos');
    }

    const permiso = await this.usersRepository.obtenerPermisoPorId(permisoId);
    if (!permiso) {
      throw new NotFoundException('Permiso no encontrado');
    }

    const permisosPorDefecto = await this.usersRepository.permisosPorDefectoDeRol(
      objetivo.rolId,
    );

    const problemas = validarAsignacionPermiso({
      permisosDelActor: actor.permisosEfectivos,
      codigoPermiso: permiso.codigo,
      tipo,
      rolObjetivo: objetivo.rol,
      permisosPorDefectoDelObjetivo: permisosPorDefecto.map((p) => p.codigo),
    });

    if (problemas.length > 0) {
      throw new BadRequestException({
        message: 'No se puede asignar ese permiso',
        problemas,
      });
    }

    const individuales = await this.usersRepository.permisosIndividuales(usuarioId);
    const previo = individuales.find((p) => p.permisoId === permisoId);

    await this.usersRepository.asignarPermisoIndividual({
      usuarioId,
      permisoId,
      tipo,
      usuarioEjecutorId: actor.id,
      // Sin fila previa el usuario tenia el valor por defecto de su rol.
      valorAnterior: previo?.tipo ?? 'rol',
    });
  }
}