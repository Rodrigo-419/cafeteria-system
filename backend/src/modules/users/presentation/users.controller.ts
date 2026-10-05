// Controller HTTP de usuarios.
//
// Importante: `PATCH /users/me/password` se declara ANTES que
// `PATCH /users/:id/password`, porque si no Express interpretaria "me" como un
// valor de `:id` y trataria el cambio de contrasena propia como un
// restablecimiento sobre el usuario "me".
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { User } from '../../../common/decorators/user.decorator';
import type { UsuarioAutenticado } from '../../auth/infrastructure/jwt/jwt.strategy';
import { Actor } from '../domain/rules/alcance';
import { ActualizarUsuarioUseCase } from '../application/use-cases/actualizar-usuario.use-case';
import { AsignarPermisoUseCase } from '../application/use-cases/asignar-permiso.use-case';
import { CambiarEstadoUseCase } from '../application/use-cases/cambiar-estado.use-case';
import { CambiarPropiaPasswordUseCase } from '../application/use-cases/cambiar-propia-password.use-case';
import { CrearUsuarioUseCase } from '../application/use-cases/crear-usuario.use-case';
import { EliminarPermisoUseCase } from '../application/use-cases/eliminar-permiso.use-case';
import { ListarPermisosUsuarioUseCase } from '../application/use-cases/listar-permisos-usuario.use-case';
import { ListarUsuariosUseCase } from '../application/use-cases/listar-usuarios.use-case';
import { ObtenerUsuarioUseCase } from '../application/use-cases/obtener-usuario.use-case';
import { RestablecerPasswordUseCase } from '../application/use-cases/restablecer-password.use-case';
import {
  ActualizarUsuarioDto,
  AsignarPermisoDto,
  CambiarEstadoDto,
  CambiarPropiaPasswordDto,
  CrearUsuarioDto,
  ListarUsuariosDto,
  RestablecerPasswordDto,
} from './dto/users.dto';
import { NombreRol } from '../domain/roles';

const UUID_PIPE = new ParseUUIDPipe({ version: undefined });

@Controller('users')
@ApiTags('users')
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly crearUsuarioUseCase: CrearUsuarioUseCase,
    private readonly listarUsuariosUseCase: ListarUsuariosUseCase,
    private readonly obtenerUsuarioUseCase: ObtenerUsuarioUseCase,
    private readonly actualizarUsuarioUseCase: ActualizarUsuarioUseCase,
    private readonly cambiarEstadoUseCase: CambiarEstadoUseCase,
    private readonly restablecerPasswordUseCase: RestablecerPasswordUseCase,
    private readonly cambiarPropiaPasswordUseCase: CambiarPropiaPasswordUseCase,
    private readonly listarPermisosUsuarioUseCase: ListarPermisosUsuarioUseCase,
    private readonly asignarPermisoUseCase: AsignarPermisoUseCase,
    private readonly eliminarPermisoUseCase: EliminarPermisoUseCase,
  ) {}

  // ------------------------------------------------------------- contraseña

  @Patch('me/password')
  @ApiOperation({ summary: 'Cambia la propia contrasena (exige la actual)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async cambiarPropiaPassword(
    @User() usuario: UsuarioAutenticado,
    @Body() dto: CambiarPropiaPasswordDto,
  ): Promise<void> {
    await this.cambiarPropiaPasswordUseCase.ejecutar(
      aActor(usuario),
      dto.passwordActual,
      dto.passwordNueva,
    );
  }

  // ------------------------------------------------------------- usuarios

  @Post()
  @RequirePermission('usuarios.crear_editar')
  @ApiOperation({ summary: 'Crea un usuario' })
  crear(
    @User() usuario: UsuarioAutenticado,
    @Body() dto: CrearUsuarioDto,
  ) {
    return this.crearUsuarioUseCase.ejecutar(aActor(usuario), {
      nombre: dto.nombre,
      email: dto.email,
      password: dto.password,
      rol: dto.rol as NombreRol,
      sucursalId: dto.sucursalId ?? null,
    });
  }

  @Get()
  @RequirePermission('usuarios.crear_editar')
  @ApiOperation({ summary: 'Lista usuarios con paginado y filtros' })
  listar(@User() usuario: UsuarioAutenticado, @Query() dto: ListarUsuariosDto) {
    return this.listarUsuariosUseCase.ejecutar(aActor(usuario), {
      page: dto.page,
      limit: dto.limit,
      sucursalId: dto.sucursalId,
      rol: dto.rol,
      estado: dto.estado,
      q: dto.q,
    });
  }

  @Get(':id')
  @RequirePermission('usuarios.crear_editar')
  @ApiOperation({ summary: 'Obtiene un usuario por id' })
  obtener(@User() usuario: UsuarioAutenticado, @Param('id', UUID_PIPE) id: string) {
    return this.obtenerUsuarioUseCase.ejecutar(aActor(usuario), id);
  }

  @Patch(':id')
  @RequirePermission('usuarios.crear_editar')
  @ApiOperation({ summary: 'Actualiza nombre, email, rol y sucursal' })
  actualizar(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: ActualizarUsuarioDto,
  ) {
    return this.actualizarUsuarioUseCase.ejecutar(aActor(usuario), id, {
      nombre: dto.nombre,
      email: dto.email,
      rol: dto.rol as NombreRol | undefined,
      sucursalId: dto.sucursalId,
    });
  }

  @Patch(':id/estado')
  @RequirePermission('usuarios.crear_editar')
  @ApiOperation({ summary: 'Activa o bloquea un usuario' })
  cambiarEstado(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: CambiarEstadoDto,
  ) {
    return this.cambiarEstadoUseCase.ejecutar(aActor(usuario), id, dto.estado);
  }

  @Patch(':id/password')
  @RequirePermission('usuarios.crear_editar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Restablece la contrasena de un usuario' })
  async restablecerPassword(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: RestablecerPasswordDto,
  ): Promise<void> {
    await this.restablecerPasswordUseCase.ejecutar(aActor(usuario), id, dto.password);
  }

  // ------------------------------------------------------------- permisos

  @Get(':id/permisos')
  @RequirePermission('permisos.asignar')
  @ApiOperation({ summary: 'Permisos efectivos del usuario con su origen' })
  listarPermisos(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.listarPermisosUsuarioUseCase.ejecutar(aActor(usuario), id);
  }

  @Put(':id/permisos/:permisoId')
  @RequirePermission('permisos.asignar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Concede o revoca un permiso individual' })
  async asignarPermiso(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Param('permisoId', UUID_PIPE) permisoId: string,
    @Body() dto: AsignarPermisoDto,
  ): Promise<void> {
    await this.asignarPermisoUseCase.ejecutar(
      aActor(usuario),
      id,
      permisoId,
      dto.tipo,
    );
  }

  @Delete(':id/permisos/:permisoId')
  @RequirePermission('permisos.asignar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un permiso individual' })
  async eliminarPermiso(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Param('permisoId', UUID_PIPE) permisoId: string,
  ): Promise<void> {
    await this.eliminarPermisoUseCase.ejecutar(aActor(usuario), id, permisoId);
  }
}

/** Reduce `request.user` al recorte minimo que exigen las reglas de dominio. */
function aActor(usuario: UsuarioAutenticado): Actor {
  return {
    id: usuario.id,
    rol: usuario.rol,
    sucursalId: usuario.sucursalId,
    permisosEfectivos: usuario.permisosEfectivos,
  };
}