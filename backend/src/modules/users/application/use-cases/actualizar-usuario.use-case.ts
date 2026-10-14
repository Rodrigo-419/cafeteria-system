// Caso de uso: actualizar nombre, nombre de usuario, rol y sucursal de un
// usuario.
//
// Nombre y nombre de usuario los puede cambiar cualquiera con alcance. Rol y
// sucursal solo si quien edita es Admin. El ultimo Admin activo no puede dejar
// de serlo. Cada cambio real deja su propio evento de auditoria en la misma
// transaccion; un PATCH sin cambios reales no genera ningun evento.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditoriaRepository } from '../../../auditoria/infrastructure/auditoria.repository';
import { Actor, filtroAlcanceListado } from '../../domain/rules/alcance';
import { esAdmin, NombreRol } from '../../domain/roles';
import {
  dejaSinAdminActivo,
  puedeModificarSuPropioRol,
  validarRolYSucursal,
} from '../../domain/rules/reglas-rol-sucursal';
import {
  ClienteUsuarios,
  UsuarioRespuesta,
  UsersRepository,
} from '../../infrastructure/users.repository';
import {
  normalizarNombreUsuario,
  validarNombreUsuario,
} from '../../../auth/domain/rules/nombre-usuario';

export type EntradaActualizarUsuario = {
  nombre?: string;
  nombreUsuario?: string;
  rol?: NombreRol;
  sucursalId?: string | null;
};

@Injectable()
export class ActualizarUsuarioUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  async ejecutar(
    actor: Actor,
    id: string,
    entrada: EntradaActualizarUsuario,
  ): Promise<UsuarioRespuesta> {
    const alcance = filtroAlcanceListado(actor);

    return this.usersRepository.enTransaccion(async (cliente) => {
      const objetivo = await this.usersRepository.buscarPorIdEnAlcance(
        id,
        alcance,
        cliente,
      );

      if (!objetivo) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const cambiaRolOSucursal =
        entrada.rol !== undefined || entrada.sucursalId !== undefined;

      // Regla: solo el Admin cambia rol o sucursal.
      //
      // El 404 de arriba solo protege a usuarios FUERA del alcance del actor. Si
      // el usuario esta en su alcance pero intenta cambiar rol o sucursal, se
      // responde 403: el recurso existe y es visible, lo que se rechaza es la
      // operacion. Asi el Gerente sabe que su limite es de permisos y no de
      // visibilidad.
      if (cambiaRolOSucursal && !esAdmin(actor.rol)) {
        throw new ForbiddenException('Solo un Admin puede cambiar el rol o la sucursal');
      }

      // Nadie cambia su propio rol.
      if (entrada.rol !== undefined && !puedeModificarSuPropioRol(actor.id, id)) {
        throw new BadRequestException('No puedes cambiar tu propio rol');
      }

      const nombreUsuarioEntrada = entrada.nombreUsuario;
      let nombreUsuario: string | undefined;
      if (nombreUsuarioEntrada !== undefined) {
        nombreUsuario = normalizarNombreUsuario(nombreUsuarioEntrada);

        const problemasNombreUsuario = validarNombreUsuario(nombreUsuarioEntrada);
        if (problemasNombreUsuario.length > 0) {
          throw new BadRequestException({
            message: 'El nombre de usuario no es valido',
            problemas: problemasNombreUsuario,
          });
        }

        if (
          await this.usersRepository.nombreUsuarioEnUso(
            nombreUsuario,
            id,
            cliente,
          )
        ) {
          throw new ConflictException('El nombre de usuario ya esta registrado');
        }
      }

      const rolId = await this.resolverRolId(entrada.rol, cliente);
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
        if (!(await this.usersRepository.existeSucursal(sucursalId, cliente))) {
          throw new BadRequestException('La sucursal indicada no existe');
        }
      }

      // El ultimo Admin activo no puede dejar de ser Admin.
      if (entrada.rol !== undefined && entrada.rol !== objetivo.rol) {
        await this.protegerUltimoAdmin(
          objetivo.rol,
          objetivo.estado,
          entrada.rol !== 'Admin',
          cliente,
        );
      }

      const actualizado = await this.usersRepository.actualizarUsuario(
        id,
        {
          ...(entrada.nombre !== undefined ? { nombre: entrada.nombre } : {}),
          ...(nombreUsuario !== undefined ? { nombreUsuario } : {}),
          ...(rolId !== undefined ? { rolId } : {}),
          ...(sucursalId !== undefined ? { sucursalId } : {}),
        },
        cliente,
      );

      await this.registrarEventos(actor, id, objetivo, entrada, {
        nombreUsuario,
        sucursalId,
        sucursalResultante: actualizado.sucursalId,
        cliente,
      });

      return actualizado;
    });
  }

  /** Escribe un evento por cada tipo de cambio real; ninguno si no hubo cambios. */
  private async registrarEventos(
    actor: Actor,
    id: string,
    objetivo: { nombre: string; nombreUsuario: string; rol: string; sucursalId: string | null },
    entrada: EntradaActualizarUsuario,
    resultado: {
      nombreUsuario: string | undefined;
      sucursalId: string | null | undefined;
      sucursalResultante: string | null;
      cliente: ClienteUsuarios;
    },
  ): Promise<void> {
    const { nombreUsuario, sucursalId, sucursalResultante, cliente } = resultado;

    const cambioNombre =
      entrada.nombre !== undefined && entrada.nombre !== objetivo.nombre;
    const cambioNombreUsuario =
      nombreUsuario !== undefined && nombreUsuario !== objetivo.nombreUsuario;

    if (cambioNombre || cambioNombreUsuario) {
      await this.auditoria.registrar(
        {
          entidad: 'usuario',
          entidadId: id,
          accion: 'usuario_editado',
          actorId: actor.id,
          usuarioAfectadoId: id,
          sucursalAfectadaId: sucursalResultante,
          detalle: {
            antes: {
              ...(cambioNombre ? { nombre: objetivo.nombre } : {}),
              ...(cambioNombreUsuario
                ? { nombreUsuario: objetivo.nombreUsuario }
                : {}),
            },
            despues: {
              ...(cambioNombre ? { nombre: entrada.nombre } : {}),
              ...(cambioNombreUsuario ? { nombreUsuario } : {}),
            },
          },
        },
        cliente,
      );
    }

    if (entrada.rol !== undefined && entrada.rol !== objetivo.rol) {
      await this.auditoria.registrar(
        {
          entidad: 'usuario',
          entidadId: id,
          accion: 'usuario_rol_cambiado',
          actorId: actor.id,
          usuarioAfectadoId: id,
          sucursalAfectadaId: sucursalResultante,
          detalle: {
            antes: { rol: objetivo.rol },
            despues: { rol: entrada.rol },
          },
        },
        cliente,
      );
    }

    if (sucursalId !== undefined && sucursalId !== objetivo.sucursalId) {
      await this.auditoria.registrar(
        {
          entidad: 'usuario',
          entidadId: id,
          accion: 'usuario_sucursal_cambiada',
          actorId: actor.id,
          usuarioAfectadoId: id,
          sucursalAfectadaId: sucursalResultante,
          detalle: {
            antes: { sucursalId: objetivo.sucursalId },
            despues: { sucursalId: sucursalId ?? null },
          },
        },
        cliente,
      );
    }
  }

  private async resolverRolId(
    rol: NombreRol | undefined,
    cliente: ClienteUsuarios,
  ): Promise<string | undefined> {
    if (rol === undefined) {
      return undefined;
    }

    const rolRegistrado = await this.usersRepository.obtenerRolPorNombre(
      rol,
      cliente,
    );
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
    cliente: ClienteUsuarios,
  ): Promise<void> {
    const quedaSinAdmin = dejaSinAdminActivo({
      objetivoEsAdminActivo: rolActual === 'Admin' && estadoActual === 'activo',
      adminsActivosTotales: await this.usersRepository.contarAdminsActivos(
        undefined,
        cliente,
      ),
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
