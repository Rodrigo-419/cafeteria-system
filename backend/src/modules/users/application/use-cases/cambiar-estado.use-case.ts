// Caso de uso: activar o bloquear un usuario.
//
// Nadie puede cambiar su propio estado y el ultimo Admin activo no puede ser
// bloqueado. Fuera de alcance responde 404.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditoriaRepository } from '../../../auditoria/infrastructure/auditoria.repository';
import { Actor, filtroAlcanceListado } from '../../domain/rules/alcance';
import {
  dejaSinAdminActivo,
  puedeModificarSuPropioEstado,
} from '../../domain/rules/reglas-rol-sucursal';
import {
  ClienteUsuarios,
  UsuarioRespuesta,
  UsersRepository,
} from '../../infrastructure/users.repository';

@Injectable()
export class CambiarEstadoUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  /**
   * `cliente` es opcional: sin el se abre una transaccion propia. Cuando se
   * pasa un cliente transaccional, todo el cambio de estado (lectura del
   * objetivo, conteo de Admins, escritura y evento de auditoria) ocurre dentro
   * de esa transaccion, para que otro caso de uso (p. ej. el cese de un
   * empleado) pueda encadenarlo con sus propias escrituras.
   */
  async ejecutar(
    actor: Actor,
    id: string,
    estado: 'activo' | 'bloqueado',
    cliente?: ClienteUsuarios,
  ): Promise<UsuarioRespuesta> {
    if (cliente !== undefined) {
      return this.enCliente(actor, id, estado, cliente);
    }

    return this.usersRepository.enTransaccion((tx) =>
      this.enCliente(actor, id, estado, tx),
    );
  }

  private async enCliente(
    actor: Actor,
    id: string,
    estado: 'activo' | 'bloqueado',
    cliente: ClienteUsuarios,
  ): Promise<UsuarioRespuesta> {
    const alcance = filtroAlcanceListado(actor);
    const objetivo = await this.usersRepository.buscarPorIdEnAlcance(
      id,
      alcance,
      cliente,
    );

    if (!objetivo) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!puedeModificarSuPropioEstado(actor.id, id)) {
      throw new BadRequestException('No puedes cambiar tu propio estado');
    }

    const quedaSinAdmin = dejaSinAdminActivo({
      objetivoEsAdminActivo: objetivo.rol === 'Admin' && objetivo.estado === 'activo',
      adminsActivosTotales: await this.usersRepository.contarAdminsActivos(
        undefined,
        cliente,
      ),
      cambiaEstadoABloqueado: estado === 'bloqueado',
      dejaDeSerAdmin: false,
    });

    if (quedaSinAdmin) {
      throw new ConflictException(
        'No se puede bloquear al ultimo Admin activo',
      );
    }

    const actualizado = await this.usersRepository.actualizarEstado(
      id,
      estado,
      cliente,
    );

    await this.auditoria.registrar(
      {
        entidad: 'usuario',
        entidadId: id,
        accion: estado === 'bloqueado' ? 'usuario_bloqueado' : 'usuario_activado',
        actorId: actor.id,
        usuarioAfectadoId: id,
        sucursalAfectadaId: objetivo.sucursalId,
        detalle: {
          antes: { estado: objetivo.estado },
          despues: { estado },
        },
      },
      cliente,
    );

    return actualizado;
  }
}
