// Controller HTTP del catalogo de variantes de producto.
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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { User } from '../../common/decorators/user.decorator';
import type { UsuarioAutenticado } from '../auth/infrastructure/jwt/jwt.strategy';
import { VariantesService } from './variantes.service';
import {
  ActualizarVarianteDto,
  CrearVarianteDto,
} from './dto/variantes.dto';

const UUID_PIPE = new ParseUUIDPipe({ version: 'all' });

@Controller('variants')
@ApiTags('variants')
@ApiBearerAuth()
export class VariantsController {
  constructor(private readonly variantesService: VariantesService) {}

  @Get()
  @RequirePermission('productos.ver')
  @ApiOperation({ summary: 'Lista las variantes de producto' })
  listar(@User() _usuario: UsuarioAutenticado) {
    return this.variantesService.listar();
  }

  @Get(':id')
  @RequirePermission('productos.ver')
  @ApiOperation({ summary: 'Obtiene una variante por id' })
  obtener(
    @User() _usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.variantesService.obtener(id);
  }

  @Post()
  @RequirePermission('productos.catalogo.editar')
  @ApiOperation({ summary: 'Crea una variante de producto' })
  crear(@User() _usuario: UsuarioAutenticado, @Body() dto: CrearVarianteDto) {
    return this.variantesService.crear(dto.nombre);
  }

  @Patch(':id')
  @RequirePermission('productos.catalogo.editar')
  @ApiOperation({ summary: 'Renombra una variante de producto' })
  actualizar(
    @User() _usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: ActualizarVarianteDto,
  ) {
    return this.variantesService.actualizar(id, dto.nombre);
  }

  @Delete(':id')
  @RequirePermission('productos.catalogo.editar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra una variante sin precios asociados' })
  async eliminar(
    @User() _usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
  ): Promise<void> {
    await this.variantesService.eliminar(id);
  }
}
