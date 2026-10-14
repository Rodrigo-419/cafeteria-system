// Caso de uso: eliminar el permiso individual de un usuario, que vuelve al
// valor por defecto de su rol.
//
// El borrado, su historial heredado y el evento de auditoria se escriben en la
// misma transaccion.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditoriaRepository } from '../../../auditoria/infrastructure/auditoria.repository';
import { Actor, filtroAlcanceListado } from '../../domain/rules/alcance';
import { puedeModificarSusPropiosPermisos } from '../../domain/rules/reglas-rol-sucursal';
import { UsersRepository } from '../../infrastructure/users.repository';

@Injectable()
export class EliminarPermisoUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  async ejecutar(
    actor: Actor,
    usuarioId: string,
    permisoId: string,
  ): Promise<void> {
    const alcance = filtroAlcanceListado(actor);

    await this.usersRepository.enTransaccion(async (cliente) => {
      const objetivo = await this.usersRepository.buscarPorIdEnAlcance(
        usuarioId,
        alcance,
        cliente,
      );

      if (!objetivo) {
        throw new NotFoundException('Usuario no encontrado');
      }

      if (!puedeModificarSusPropiosPermisos(actor.id, usuarioId)) {
        throw new BadRequestException('No puedes cambiar tus propios permisos');
      }

      const permiso = await this.usersRepository.obtenerPermisoPorId(
        permisoId,
        cliente,
      );
      if (!permiso) {
        throw new NotFoundException('Permiso no encontrado');
      }

      const individuales = await this.usersRepository.permisosIndividuales(
        usuarioId,
        cliente,
      );
      const previo = individuales.find((p) => p.permisoId === permisoId);

      if (!previo) {
        throw new NotFoundException(
          'El usuario no tiene un permiso individual que eliminar',
        );
      }

      await this.usersRepository.eliminarPermisoIndividual(
        {
          usuarioId,
          permisoId,
          usuarioEjecutorId: actor.id,
          tipoPrevio: previo.tipo,
          valorAnterior: previo.tipo,
        },
        cliente,
      );

      await this.auditoria.registrar(
        {
          entidad: 'usuario',
          entidadId: usuarioId,
          accion: 'permiso_restablecido',
          actorId: actor.id,
          usuarioAfectadoId: usuarioId,
          sucursalAfectadaId: objetivo.sucursalId,
          detalle: {
            antes: { permiso: permiso.codigo, tipo: previo.tipo },
          },
        },
        cliente,
      );
    });
  }
}
