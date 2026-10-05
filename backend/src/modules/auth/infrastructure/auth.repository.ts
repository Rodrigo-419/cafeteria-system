// Repositorio de autenticacion: consultas sobre usuarios, rol y permisos.
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { $Enums, Prisma } from '../../../generated/prisma/client';

export type UsuarioConPermisosBrutos = {
  id: string;
  nombre: string;
  email: string;
  passwordHash: string;
  estado: $Enums.UsuarioEstado;
  rolId: string | null;
  sucursalId: string | null;
  rol: {
    nombre: string;
    rolesPermiso: {
      permiso: {
        codigo: string;
      };
    }[];
  } | null;
  permisos: {
    tipo: $Enums.UsuarioPermisoTipo;
    permiso: {
      codigo: string;
    };
  }[];
};

const SELECT_USUARIO_CON_PERMISOS = {
  id: true,
  nombre: true,
  email: true,
  passwordHash: true,
  estado: true,
  rolId: true,
  sucursalId: true,
  rol: {
    select: {
      nombre: true,
      rolesPermiso: {
        select: {
          permiso: {
            select: {
              codigo: true,
            },
          },
        },
      },
    },
  },
  permisos: {
    select: {
      tipo: true,
      permiso: {
        select: {
          codigo: true,
        },
      },
    },
  },
} satisfies Prisma.UsuarioSelect;

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca un usuario por email, incluyendo rol, permisos del rol y permisos
   * individuales (usuario_permiso). Util para el caso de login.
   */
  async buscarUsuarioPorEmail(email: string): Promise<UsuarioConPermisosBrutos | null> {
    return this.prisma.usuario.findUnique({
      where: { email },
      select: SELECT_USUARIO_CON_PERMISOS,
    });
  }

  /**
   * Busca un usuario por id, incluyendo rol, permisos del rol y permisos
   * individuales. Util para cargar el usuario autenticado desde el JWT
   * (la estrategia siempre consulta la base para detectar bloqueos o borrados).
   */
  async buscarUsuarioPorId(id: string): Promise<UsuarioConPermisosBrutos | null> {
    return this.prisma.usuario.findUnique({
      where: { id },
      select: SELECT_USUARIO_CON_PERMISOS,
    });
  }

  /**
   * Carga un usuario activo por id para la estrategia JWT. Si no existe o
   * no esta activo, lanza UnauthorizedException (401).
   */
  async obtenerUsuarioActivoPorId(id: string): Promise<UsuarioConPermisosBrutos> {
    const usuario = await this.buscarUsuarioPorId(id);
    if (!usuario || usuario.estado !== 'activo') {
      throw new UnauthorizedException('Token invalido');
    }
    return usuario;
  }
}