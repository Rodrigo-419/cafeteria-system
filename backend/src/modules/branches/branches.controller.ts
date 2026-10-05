// Controller HTTP de sucursales.
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { User } from '../../common/decorators/user.decorator';
import type { UsuarioAutenticado } from '../auth/infrastructure/jwt/jwt.strategy';
import { BranchesService, type ActorSucursales } from './branches.service';
import {
  ActualizarSucursalDto,
  CrearSucursalDto,
} from './dto/branches.dto';

// `version: 'all'` acepta cualquier version de UUID, incluida la v7 que genera
// Prisma. Es el equivalente de ruta de `@IsUUID('all')`: los decoradores de
// class-validator solo se ejecutan sobre el cuerpo de la peticion, no sobre un
// parametro, asi que para el `:id` toca el pipe de Nest.
const UUID_PIPE = new ParseUUIDPipe({ version: 'all' });

@Controller('branches')
@ApiTags('branches')
@ApiBearerAuth()
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @RequirePermission('sucursales.crear_editar')
  @ApiOperation({ summary: 'Crea una sucursal' })
  crear(@User() usuario: UsuarioAutenticado, @Body() dto: CrearSucursalDto) {
    return this.branchesService.crear(aActor(usuario), {
      nombre: dto.nombre,
      direccion: dto.direccion,
      telefono: dto.telefono,
    });
  }

  @Get()
  @RequirePermission('sucursales.ver')
  @ApiOperation({
    summary: 'Lista sucursales: el Admin ve todas, el resto solo la suya',
  })
  listar(@User() usuario: UsuarioAutenticado) {
    return this.branchesService.listar(aActor(usuario));
  }

  @Get(':id')
  @RequirePermission('sucursales.ver')
  @ApiOperation({ summary: 'Obtiene una sucursal por id' })
  obtener(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.branchesService.obtener(aActor(usuario), id);
  }

  @Patch(':id')
  @RequirePermission('sucursales.crear_editar')
  @ApiOperation({ summary: 'Edita nombre, direccion y telefono de una sucursal' })
  actualizar(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: ActualizarSucursalDto,
  ) {
    return this.branchesService.actualizar(aActor(usuario), id, {
      nombre: dto.nombre,
      direccion: dto.direccion,
      telefono: dto.telefono,
    });
  }
}

/** Reduce `request.user` al recorte minimo que exigen las reglas de sucursales. */
function aActor(usuario: UsuarioAutenticado): ActorSucursales {
  return {
    id: usuario.id,
    rol: usuario.rol,
    sucursalId: usuario.sucursalId,
  };
}
