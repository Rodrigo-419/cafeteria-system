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
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * `cliente` es opcional: sin el se usa `PrismaService`. Cuando se pasa un
   * cliente transaccional, todo el cambio de estado (lectura del objetivo,
   * conteo de Admins y escritura) ocurre dentro de esa transaccion, para que
   * otro caso de uso pueda encadenar el cambio de estado con sus propias
   * escrituras y que todas confirmen o fallen juntas.
   */
  async ejecutar(
    actor: Actor,
    id: string,
    estado: 'activo' | 'bloqueado',
    cliente?: ClienteUsuarios,
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

    return this.usersRepository.actualizarEstado(id, estado, cliente);
  }
}