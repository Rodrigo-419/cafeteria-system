// Caso de uso: actualizar nombre, email, rol y sucursal de un usuario.
//
// Nombre y email los puede cambiar cualquiera con alcance. Rol y sucursal solo
// si quien edita es Admin. El ultimo Admin activo no puede dejar de serlo.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Actor, filtroAlcanceListado } from '../../domain/rules/alcance';
import { esAdmin, NombreRol } from '../../domain/roles';
import {
  dejaSinAdminActivo,
  puedeModificarSuPropioRol,
  validarRolYSucursal,
} from '../../domain/rules/reglas-rol-sucursal';
import {
  UsuarioRespuesta,
  UsersRepository,
} from '../../infrastructure/users.repository';
import { normalizarEmail } from './crear-usuario.use-case';

export type EntradaActualizarUsuario = {
  nombre?: string;
  email?: string;
  rol?: NombreRol;
  sucursalId?: string | null;
};

@Injectable()
export class ActualizarUsuarioUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async ejecutar(
    actor: Actor,
    id: string,
    entrada: EntradaActualizarUsuario,
  ): Promise<UsuarioRespuesta> {
    const alcance = filtroAlcanceListado(actor);
    const objetivo = await this.usersRepository.buscarPorIdEnAlcance(id, alcance);

    if (!objetivo) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const cambiaRolOSucursal =
      entrada.rol !== undefined || entrada.sucursalId !== undefined;

    // Regla: solo el Admin cambia rol o sucursal.
    //
    // El 404 de arriba solo protege a usuarios FUERA del alcance del actor. Si el
    // usuario esta en su alcance pero intenta cambiar rol o sucursal, se responde
    // 403: el recurso existe y es visible, lo que se rechaza es la operacion.
    // Asi el Gerente sabe que su limite es de permisos y no de visibilidad.
    if (cambiaRolOSucursal && !esAdmin(actor.rol)) {
      throw new ForbiddenException('Solo un Admin puede cambiar el rol o la sucursal');
    }

    // Nadie cambia su propio rol.
    if (entrada.rol !== undefined && !puedeModificarSuPropioRol(actor.id, id)) {
      throw new BadRequestException('No puedes cambiar tu propio rol');
    }

    const email = entrada.email !== undefined ? normalizarEmail(entrada.email) : undefined;

    if (email !== undefined && (await this.usersRepository.emailEnUso(email, id))) {
      throw new ConflictException('El correo electronico ya esta registrado');
    }

    const rolId = await this.resolverRolId(entrada.rol);
    const sucursalId =
      entrada.rol !== undefined || entrada.sucursalId !== undefined
        ? (entrada.sucursalId ?? null)
        : undefined;

    // La combinacion rol/sucursal resultante debe ser valida.
    if (rolId !== undefined || sucursalId !== undefined) {
      const rolEfectivo = entrada.rol ?? objetivo.rol;
      const problemas = validarRolYSucursal(
        rolEfectivo as NombreRol,
        sucursalId !== undefined ? sucursalId : objetivo.sucursalId,
      );

      if (problemas.length > 0) {
        throw new BadRequestException({
          message: 'Combinacion de rol y sucursal invalida',
          problemas,
        });
      }
    }

    if (sucursalId !== null && sucursalId !== undefined) {
      if (!(await this.usersRepository.existeSucursal(sucursalId))) {
        throw new BadRequestException('La sucursal indicada no existe');
      }
    }

    // El ultimo Admin activo no puede dejar de ser Admin.
    if (entrada.rol !== undefined && entrada.rol !== objetivo.rol) {
      await this.protegerUltimoAdmin(
        objetivo.rol,
        objetivo.estado,
        entrada.rol !== 'Admin',
      );
    }

    return this.usersRepository.actualizarUsuario(id, {
      ...(entrada.nombre !== undefined ? { nombre: entrada.nombre } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(rolId !== undefined ? { rolId } : {}),
      ...(sucursalId !== undefined ? { sucursalId } : {}),
    });
  }

  private async resolverRolId(rol: NombreRol | undefined): Promise<string | undefined> {
    if (rol === undefined) {
      return undefined;
    }

    const rolRegistrado = await this.usersRepository.obtenerRolPorNombre(rol);
    if (!rolRegistrado) {
      throw new BadRequestException(`El rol ${rol} no existe`);
    }

    return rolRegistrado.id;
  }

  /**
   * Lanza 409 si el cambio dejaria la instancia sin ningun Admin activo.
   */
  private async protegerUltimoAdmin(
    rolActual: string,
    estadoActual: string,
    dejaDeSerAdmin: boolean,
  ): Promise<void> {
    const quedaSinAdmin = dejaSinAdminActivo({
      objetivoEsAdminActivo: rolActual === 'Admin' && estadoActual === 'activo',
      adminsActivosTotales: await this.usersRepository.contarAdminsActivos(),
      cambiaEstadoABloqueado: false,
      dejaDeSerAdmin,
    });

    if (quedaSinAdmin) {
      throw new ConflictException(
        'No se puede dejar al sistema sin ningun Admin activo',
      );
    }
  }
}