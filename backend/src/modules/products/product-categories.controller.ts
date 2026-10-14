// Controller HTTP del catalogo de categorias de producto.
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
import { CategoriasService } from './categorias.service';
import {
  ActualizarCategoriaDto,
  CrearCategoriaDto,
} from './dto/categorias.dto';

const UUID_PIPE = new ParseUUIDPipe({ version: 'all' });

@Controller('product-categories')
@ApiTags('product-categories')
@ApiBearerAuth()
export class ProductCategoriesController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Get()
  @RequirePermission('productos.ver')
  @ApiOperation({ summary: 'Lista las categorias de producto' })
  listar(@User() _usuario: UsuarioAutenticado) {
    return this.categoriasService.listar();
  }

  @Get(':id')
  @RequirePermission('productos.ver')
  @ApiOperation({ summary: 'Obtiene una categoria por id' })
  obtener(
    @User() _usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.categoriasService.obtener(id);
  }

  @Post()
  @RequirePermission('productos.catalogo.editar')
  @ApiOperation({ summary: 'Crea una categoria de producto' })
  crear(@User() usuario: UsuarioAutenticado, @Body() dto: CrearCategoriaDto) {
    return this.categoriasService.crear(usuario.id, dto.nombre);
  }

  @Patch(':id')
  @RequirePermission('productos.catalogo.editar')
  @ApiOperation({ summary: 'Renombra una categoria de producto' })
  actualizar(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: ActualizarCategoriaDto,
  ) {
    return this.categoriasService.actualizar(usuario.id, id, dto.nombre);
  }

  @Delete(':id')
  @RequirePermission('productos.catalogo.editar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra una categoria vacia' })
  async eliminar(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
  ): Promise<void> {
    await this.categoriasService.eliminar(usuario.id, id);
  }
}
