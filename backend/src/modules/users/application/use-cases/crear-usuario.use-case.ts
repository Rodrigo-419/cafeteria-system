// Caso de uso: crear un usuario.
//
// Un Admin puede crear cualquier rol. Un Gerente solo crea Empleados y la
// sucursal se fuerza a la suya, ignorando la que envie el cliente.
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuditoriaRepository } from '../../../auditoria/infrastructure/auditoria.repository';
import { validarPassword } from '../../../auth/domain/rules/password-policy';
import {
  normalizarNombreUsuario,
  validarNombreUsuario,
} from '../../../auth/domain/rules/nombre-usuario';
import { esGerente, NombreRol } from '../../domain/roles';
import { forzarRolYSucursalAlCrear, validarRolYSucursal } from '../../domain/rules/reglas-rol-sucursal';
import {
  UsuarioRespuesta,
  UsersRepository,
} from '../../infrastructure/users.repository';

/** 12 rondas de bcrypt, segun la politica del proyecto. */
export const RONDAS_BCRYPT = 12;

export type ActorCrearUsuario = {
  id: string;
  rol: string | null;
  sucursalId: string | null;
};

export type EntradaCrearUsuario = {
  nombre: string;
  nombreUsuario: string;
  password: string;
  rol: NombreRol;
  sucursalId?: string | null;
};

@Injectable()
export class CrearUsuarioUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  async ejecutar(
    actor: ActorCrearUsuario,
    entrada: EntradaCrearUsuario,
  ): Promise<UsuarioRespuesta> {
    const nombreUsuario = normalizarNombreUsuario(entrada.nombreUsuario);

    // Regla del identificador de acceso: misma funcion pura que usan el login y
    // el resto de altas/ediciones. Devuelve la lista de problemas (400).
    const problemasNombreUsuario = validarNombreUsuario(entrada.nombreUsuario);
    if (problemasNombreUsuario.length > 0) {
      throw new BadRequestException({
        message: 'El nombre de usuario no es valido',
        problemas: problemasNombreUsuario,
      });
    }

    // Politica de contrasena: devuelve la lista de problemas (400).
    const problemasPassword = validarPassword(entrada.password);
    if (problemasPassword.length > 0) {
      throw new BadRequestException({
        message: 'La contrasena no cumple la politica de seguridad',
        problemas: problemasPassword,
      });
    }

    // El Gerente solo puede crear Empleados, y el Admin es el unico que puede
    // pedir el rol Admin. Cualquier otro rol no existe (el DTO ya lo filtra).
    if (esGerente(actor.rol) && entrada.rol !== 'Empleado') {
      throw new ForbiddenException(
        'Un Gerente solo puede crear usuarios con rol Empleado',
      );
    }

    const { rol, sucursalId } = forzarRolYSucursalAlCrear(
      actor,
      entrada.rol,
      entrada.sucursalId ?? null,
    );

    const problemasRol = validarRolYSucursal(rol, sucursalId);
    if (problemasRol.length > 0) {
      throw new BadRequestException({
        message: 'Combinacion de rol y sucursal invalida',
        problemas: problemasRol,
      });
    }

    const passwordHash = await bcrypt.hash(entrada.password, RONDAS_BCRYPT);

    return this.usersRepository.enTransaccion(async (cliente) => {
      // Las comprobaciones de unicidad van DENTRO de la transaccion, junto a la
      // escritura y al evento de auditoria: todo confirma o falla junto.
      if (
        await this.usersRepository.nombreUsuarioEnUso(
          nombreUsuario,
          undefined,
          cliente,
        )
      ) {
        throw new ConflictException('El nombre de usuario ya esta registrado');
      }

      if (
        sucursalId !== null &&
        !(await this.usersRepository.existeSucursal(sucursalId, cliente))
      ) {
        throw new BadRequestException('La sucursal indicada no existe');
      }

      const rolRegistrado = await this.usersRepository.obtenerRolPorNombre(
        rol,
        cliente,
      );
      if (!rolRegistrado) {
        throw new BadRequestException(`El rol ${rol} no existe`);
      }

      const usuario = await this.usersRepository.crearUsuario(
        {
          nombre: entrada.nombre,
          nombreUsuario,
          passwordHash,
          rolId: rolRegistrado.id,
          sucursalId,
        },
        cliente,
      );

      await this.auditoria.registrar(
        {
          entidad: 'usuario',
          entidadId: usuario.id,
          accion: 'usuario_creado',
          actorId: actor.id,
          usuarioAfectadoId: usuario.id,
          sucursalAfectadaId: usuario.sucursalId,
          detalle: {
            despues: {
              nombre: usuario.nombre,
              nombreUsuario: usuario.nombreUsuario,
              rol: usuario.rol,
              sucursalId: usuario.sucursalId,
            },
          },
        },
        cliente,
      );

      return usuario;
    });
  }
}