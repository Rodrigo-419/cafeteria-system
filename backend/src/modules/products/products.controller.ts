// Controller HTTP del catalogo global de productos.
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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { User } from '../../common/decorators/user.decorator';
import type { UsuarioAutenticado } from '../auth/infrastructure/jwt/jwt.strategy';
import { ProductosService } from './productos.service';
import {
  ActualizarProductoDto,
  CrearProductoDto,
  ListarProductosDto,
} from './dto/productos.dto';

const UUID_PIPE = new ParseUUIDPipe({ version: 'all' });

@Controller('products')
@ApiTags('products')
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productosService: ProductosService) {}

  @Get()
  @RequirePermission('productos.ver')
  @ApiOperation({ summary: 'Lista productos con paginado, categoria y busqueda' })
  listar(@User() _usuario: UsuarioAutenticado, @Query() dto: ListarProductosDto) {
    return this.productosService.listar({
      page: dto.page,
      limit: dto.limit,
      categoriaId: dto.categoriaId,
      q: dto.q,
    });
  }

  @Get(':id')
  @RequirePermission('productos.ver')
  @ApiOperation({ summary: 'Obtiene un producto por id' })
  obtener(
    @User() _usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.productosService.obtener(id);
  }

  @Post()
  @RequirePermission('productos.catalogo.editar')
  @ApiOperation({ summary: 'Crea un producto en una categoria' })
  crear(@User() _usuario: UsuarioAutenticado, @Body() dto: CrearProductoDto) {
    return this.productosService.crear({
      nombre: dto.nombre,
      categoriaId: dto.categoriaId,
      descripcion: dto.descripcion,
    });
  }

  @Patch(':id')
  @RequirePermission('productos.catalogo.editar')
  @ApiOperation({ summary: 'Edita un producto' })
  actualizar(
    @User() _usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: ActualizarProductoDto,
  ) {
    return this.productosService.actualizar(id, {
      nombre: dto.nombre,
      categoriaId: dto.categoriaId,
      descripcion: dto.descripcion,
    });
  }

  @Delete(':id')
  @RequirePermission('productos.catalogo.editar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra un producto sin precios asociados' })
  async eliminar(
    @User() _usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
  ): Promise<void> {
    await this.productosService.eliminar(id);
  }
}
