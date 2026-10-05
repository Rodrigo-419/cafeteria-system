// Repositorio de usuarios: consultas Prisma con select explicito.
// `passwordHash` solo se pide donde hace falta (restablecer/cambiar la propia
// contraseña y verificar la actual); ningun listado lo devuelve.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  $Enums,
  HistorialPermisosAccion,
  Prisma,
  UsuarioPermisoTipo,
} from '../../../generated/prisma/client';
import type { TipoPermisoIndividual } from '../domain/rules/reglas-permisos';

/** Rol con id y nombre, para resolver roles por nombre. */
export type RolBasico = {
  id: string;
  nombre: string;
};

/** Fila de usuario sin hash, segura para devolver en la API. */
export type UsuarioRespuesta = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  rolId: string;
  sucursalId: string | null;
  estado: $Enums.UsuarioEstado;
  createdAt: Date;
  updatedAt: Date;
};

/** Lo mínimo del objetivo para decidir alcance y reglas. */
export type UsuarioAlcance = {
  id: string;
  rol: string;
  rolId: string;
  sucursalId: string | null;
  estado: $Enums.UsuarioEstado;
};

/**
 * Unico tipo que transporta el hash. Existe separado de `UsuarioAlcance` para
 * que el compilador impida llegar a bcrypt.compare por error: si hace falta
 * comparar contrasenas hay que pedir explicitamente este tipo.
 */
export type UsuarioConHash = {
  id: string;
  passwordHash: string;
};

/** Un permiso individual tal y como viene de `usuario_permiso`. */
export type PermisoIndividualFila = {
  id: string;
  permisoId: string;
  tipo: $Enums.UsuarioPermisoTipo;
  permiso: { codigo: string; descripcion: string };
};

/** Un permiso del rol, para saber que concede el rol por defecto. */
export type PermisoDeRol = {
  permisoId: string;
  codigo: string;
  descripcion: string;
};

export type FiltrosListadoUsuarios = {
  page: number;
  limit: number;
  sucursalId?: string;
  rol?: string;
  estado?: string;
  busqueda?: string;
};

const SELECT_USUARIO_RESPUESTA = {
  id: true,
  nombre: true,
  email: true,
  rolId: true,
  sucursalId: true,
  estado: true,
  createdAt: true,
  updatedAt: true,
  rol: { select: { id: true, nombre: true } },
} satisfies Prisma.UsuarioSelect;

/**
 * Datos de alcance y de ultimo Admin. Deliberadamente SIN `passwordHash`: casi
 * ningun caso de uso necesita comparar contrasenas y arrastrarla aqui hacia el
 * caso de uso amplia el riesgo de que acabe en una respuesta.
 */
const SELECT_USUARIO_ALCANCE = {
  id: true,
  rolId: true,
  sucursalId: true,
  estado: true,
  rol: { select: { id: true, nombre: true } },
} satisfies Prisma.UsuarioSelect;

const SELECT_PERMISOS_INDIVIDUALES = {
  id: true,
  permisoId: true,
  tipo: true,
  permiso: { select: { codigo: true, descripcion: true } },
} satisfies Prisma.UsuarioPermisoSelect;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- lecturas

  async buscarPorId(id: string): Promise<UsuarioRespuesta | null> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: SELECT_USUARIO_RESPUESTA,
    });
    return usuario ? this.aUsuarioRespuesta(usuario) : null;
  }

  /**
   * Usuario con los datos que exigen las reglas de alcance y de ultimo Admin.
   * Si el objetivo no esta dentro del alcance del actor devuelve null, para
   * que la capa de presentacion lo traduzca a 404 y no revele su existencia.
   */
  async buscarPorIdEnAlcance(
    id: string,
    alcance: { sucursalId?: string; rol?: string } | undefined,
  ): Promise<UsuarioAlcance | null> {
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        id,
        ...(alcance?.sucursalId !== undefined ? { sucursalId: alcance.sucursalId } : {}),
        ...(alcance?.rol !== undefined ? { rol: { nombre: alcance.rol } } : {}),
      },
      select: SELECT_USUARIO_ALCANCE,
    });

    if (!usuario) {
      return null;
    }

    return {
      id: usuario.id,
      rol: usuario.rol.nombre,
      rolId: usuario.rolId,
      sucursalId: usuario.sucursalId,
      estado: usuario.estado,
    };
  }

  /**
   * Hash de un usuario, para el unico caso que lo compara: el cambio de
   * contrasena propia. Se pide por separado para no arrastrar el hash en el
   * resto de lecturas.
   */
  async buscarHashPorId(id: string): Promise<UsuarioConHash | null> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, passwordHash: true },
    });

    return usuario ?? null;
  }

  /** Usuario completo (sin hash) dentro del alcance del actor. */
  async buscarRespuestaEnAlcance(
    id: string,
    alcance: { sucursalId?: string; rol?: string } | undefined,
  ): Promise<UsuarioRespuesta | null> {
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        id,
        ...(alcance?.sucursalId !== undefined ? { sucursalId: alcance.sucursalId } : {}),
        ...(alcance?.rol !== undefined ? { rol: { nombre: alcance.rol } } : {}),
      },
      select: SELECT_USUARIO_RESPUESTA,
    });
    return usuario ? this.aUsuarioRespuesta(usuario) : null;
  }

  async listar(
    filtros: FiltrosListadoUsuarios,
    alcance: { sucursalId?: string; rol?: string } | undefined,
  ): Promise<UsuarioRespuesta[]> {
    const usuarios = await this.prisma.usuario.findMany({
      where: this.construirWhere(filtros, alcance),
      select: SELECT_USUARIO_RESPUESTA,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      skip: (filtros.page - 1) * filtros.limit,
      take: filtros.limit,
    });

    return usuarios.map((u) => this.aUsuarioRespuesta(u));
  }

  async contar(
    filtros: FiltrosListadoUsuarios,
    alcance: { sucursalId?: string; rol?: string } | undefined,
  ): Promise<number> {
    return this.prisma.usuario.count({
      where: this.construirWhere(filtros, alcance),
    });
  }

  async emailEnUso(email: string, exceptoUsuarioId?: string): Promise<boolean> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      select: { id: true },
    });

    return usuario !== null && usuario.id !== exceptoUsuarioId;
  }

  async existeSucursal(sucursalId: string): Promise<boolean> {
    const sucursal = await this.prisma.sucursal.findUnique({
      where: { id: sucursalId },
      select: { id: true },
    });
    return sucursal !== null;
  }

  async obtenerRolPorNombre(nombre: string): Promise<RolBasico | null> {
    return this.prisma.rol.findUnique({
      where: { nombre },
      select: { id: true, nombre: true },
    });
  }

  async obtenerPermisoPorId(permisoId: string): Promise<{
    id: string;
    codigo: string;
    descripcion: string;
  } | null> {
    return this.prisma.permiso.findUnique({
      where: { id: permisoId },
      select: { id: true, codigo: true, descripcion: true },
    });
  }

  /** Permisos que el rol del objetivo concede por defecto. */
  async permisosPorDefectoDeRol(rolId: string): Promise<PermisoDeRol[]> {
    const rolesPermiso = await this.prisma.rolPermiso.findMany({
      where: { rolId },
      select: {
        permisoId: true,
        permiso: { select: { codigo: true, descripcion: true } },
      },
    });

    return rolesPermiso.map((rp) => ({
      permisoId: rp.permisoId,
      codigo: rp.permiso.codigo,
      descripcion: rp.permiso.descripcion,
    }));
  }

  async permisosIndividuales(
    usuarioId: string,
  ): Promise<PermisoIndividualFila[]> {
    return this.prisma.usuarioPermiso.findMany({
      where: { usuarioId },
      select: SELECT_PERMISOS_INDIVIDUALES,
      orderBy: { permiso: { codigo: 'asc' } },
    });
  }

  /** Numero de Admins activos. Si se pasa id, lo excluye del conteo. */
  async contarAdminsActivos(exceptoUsuarioId?: string): Promise<number> {
    return this.prisma.usuario.count({
      where: {
        rol: { nombre: 'Admin' },
        estado: 'activo',
        ...(exceptoUsuarioId !== undefined ? { id: { not: exceptoUsuarioId } } : {}),
      },
    });
  }

  // --------------------------------------------------------------- escrituras

  async crearUsuario(data: {
    nombre: string;
    email: string;
    passwordHash: string;
    rolId: string;
    sucursalId: string | null;
  }): Promise<UsuarioRespuesta> {
    const usuario = await this.prisma.usuario.create({
      data: {
        nombre: data.nombre,
        email: data.email,
        passwordHash: data.passwordHash,
        rolId: data.rolId,
        sucursalId: data.sucursalId,
      },
      select: SELECT_USUARIO_RESPUESTA,
    });
    return this.aUsuarioRespuesta(usuario);
  }

  async actualizarUsuario(
    id: string,
    data: { nombre?: string; email?: string; rolId?: string; sucursalId?: string | null },
  ): Promise<UsuarioRespuesta> {
    const usuario = await this.prisma.usuario.update({
      where: { id },
      data,
      select: SELECT_USUARIO_RESPUESTA,
    });
    return this.aUsuarioRespuesta(usuario);
  }

  async actualizarEstado(
    id: string,
    estado: $Enums.UsuarioEstado,
  ): Promise<UsuarioRespuesta> {
    const usuario = await this.prisma.usuario.update({
      where: { id },
      data: { estado },
      select: SELECT_USUARIO_RESPUESTA,
    });
    return this.aUsuarioRespuesta(usuario);
  }

  async actualizarPassword(id: string, passwordHash: string): Promise<void> {
    await this.prisma.usuario.update({
      where: { id },
      data: { passwordHash },
      select: { id: true },
    });
  }

  /**
   * Crea o actualiza `usuario_permiso` y escribe la fila de
   * `historial_permisos` en la MISMA transaccion.
   *
   * `accion` describe el efecto sobre los permisos efectivos: "asignado" si el
   * cambio otorga el permiso, "revocado" si se lo quita. Un PUT con tipo
   * "concedido" concede, y un PUT con tipo "revocado" quita.
   */
  async asignarPermisoIndividual(params: {
    usuarioId: string;
    permisoId: string;
    tipo: TipoPermisoIndividual;
    usuarioEjecutorId: string;
    valorAnterior: string | null;
  }): Promise<void> {
    const tipo = params.tipo as UsuarioPermisoTipo;
    const accion: HistorialPermisosAccion =
      params.tipo === 'concedido' ? 'asignado' : 'revocado';

    await this.prisma.$transaction(async (tx) => {
      await tx.usuarioPermiso.upsert({
        where: {
          usuarioId_permisoId: {
            usuarioId: params.usuarioId,
            permisoId: params.permisoId,
          },
        },
        create: {
          usuarioId: params.usuarioId,
          permisoId: params.permisoId,
          tipo,
        },
        update: { tipo },
        select: { id: true },
      });

      await tx.historialPermisos.create({
        data: {
          usuarioAfectadoId: params.usuarioId,
          permisoId: params.permisoId,
          usuarioEjecutorId: params.usuarioEjecutorId,
          accion,
          valorAnterior: params.valorAnterior,
        },
        select: { id: true },
      });
    });
  }

  /**
   * Elimina el permiso individual y escribe el historial en la MISMA
   * transaccion.
   *
   * Como decide `accion` en el DELETE: `accion` describe el efecto sobre los
   * permisos efectivos del usuario, no el tipo de la fila eliminada. Al borrar
   * la fila, el usuario vuelve al valor por defecto de su rol, asi que:
   *   - se borraba un "concedido": el usuario PIERDE un permiso -> "revocado".
   *   - se borraba un "revocado": el usuario RECUPERA el permiso de su rol
   *     -> "asignado".
   * Por eso el valor anterior de la fila borrada es lo que decide la accion.
   * `valorAnterior` guarda el tipo que tenía la fila eliminada.
   */
  async eliminarPermisoIndividual(params: {
    usuarioId: string;
    permisoId: string;
    usuarioEjecutorId: string;
    tipoPrevio: TipoPermisoIndividual;
    valorAnterior: string | null;
  }): Promise<void> {
    const accion: HistorialPermisosAccion =
      params.tipoPrevio === 'concedido' ? 'revocado' : 'asignado';

    await this.prisma.$transaction(async (tx) => {
      await tx.usuarioPermiso.deleteMany({
        where: { usuarioId: params.usuarioId, permisoId: params.permisoId },
      });

      await tx.historialPermisos.create({
        data: {
          usuarioAfectadoId: params.usuarioId,
          permisoId: params.permisoId,
          usuarioEjecutorId: params.usuarioEjecutorId,
          accion,
          valorAnterior: params.valorAnterior,
        },
        select: { id: true },
      });
    });
  }

  // ------------------------------------------------------------------ privado

  /**
   * Combina el alcance del actor con los filtros solicitados usando `AND`.
   *
   * Importante: no se fusionan con "spread" sobre un mismo objeto porque el
   * ultimo en escribirse gana. Si el filtro pedido seFusionara asi, un Gerente
   * podria ampliar su alcance pidiendo `?rol=Admin` o `?sucursalId=<otra>` y
   * ver datos de fuera. Con `AND` ambos filtros se exigen a la vez, asi que un
   * filtro contrario al alcance simply no devuelve filas.
   */
  private construirWhere(
    filtros: FiltrosListadoUsuarios,
    alcance: { sucursalId?: string; rol?: string } | undefined,
  ): Prisma.UsuarioWhereInput {
    const alcanceWhere: Prisma.UsuarioWhereInput = {
      ...(alcance?.sucursalId !== undefined ? { sucursalId: alcance.sucursalId } : {}),
      ...(alcance?.rol !== undefined ? { rol: { nombre: alcance.rol } } : {}),
    };

    const filtrosWhere: Prisma.UsuarioWhereInput = {
      ...(filtros.sucursalId !== undefined ? { sucursalId: filtros.sucursalId } : {}),
      ...(filtros.rol !== undefined ? { rol: { nombre: filtros.rol } } : {}),
      ...(filtros.estado !== undefined ? { estado: filtros.estado as $Enums.UsuarioEstado } : {}),
      ...(filtros.busqueda !== undefined
        ? {
            OR: [
              { nombre: { contains: filtros.busqueda, mode: 'insensitive' } },
              { email: { contains: filtros.busqueda, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return { AND: [alcanceWhere, filtrosWhere] };
  }

  private aUsuarioRespuesta(usuario: {
    id: string;
    nombre: string;
    email: string;
    rolId: string;
    sucursalId: string | null;
    estado: $Enums.UsuarioEstado;
    createdAt: Date;
    updatedAt: Date;
    rol: { id: string; nombre: string };
  }): UsuarioRespuesta {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol.nombre,
      rolId: usuario.rolId,
      sucursalId: usuario.sucursalId,
      estado: usuario.estado,
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    };
  }
}