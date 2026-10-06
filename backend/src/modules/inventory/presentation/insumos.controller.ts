// Controller HTTP del catalogo de insumos.
//
// Ruta sin sucursal porque el catalogo es global: un "Cafe molido" es el mismo
// insumo en todas las sucursales. Lo que es por sucursal, el stock, lo gestionan
// `insumos.controller` y `movimientos.controller`.
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
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CrearInsumoUseCase } from '../application/use-cases/crear-insumo.use-case';
import { EditarInsumoUseCase } from '../application/use-cases/editar-insumo.use-case';
import { EliminarInsumoUseCase } from '../application/use-cases/eliminar-insumo.use-case';
import { ListarInsumosUseCase } from '../application/use-cases/listar-insumos.use-case';
import { ObtenerInsumoUseCase } from '../application/use-cases/obtener-insumo.use-case';
import { CrearInsumoDto, EditarInsumoDto, ListarInsumosDto } from './dto/inventory.dto';

const UUID_PIPE = new ParseUUIDPipe({ version: 'all' });

@Controller('insumos')
@ApiTags('insumos')
@ApiBearerAuth()
export class InsumosController {
  constructor(
    private readonly crearInsumoUseCase: CrearInsumoUseCase,
    private readonly editarInsumoUseCase: EditarInsumoUseCase,
    private readonly eliminarInsumoUseCase: EliminarInsumoUseCase,
    private readonly obtenerInsumoUseCase: ObtenerInsumoUseCase,
    private readonly listarInsumosUseCase: ListarInsumosUseCase,
  ) {}

  @Post()
  @RequirePermission('insumos.catalogo.editar')
  @ApiOperation({ summary: 'Crea un insumo en el catalogo global' })
  crear(@Body() dto: CrearInsumoDto) {
    return this.crearInsumoUseCase.ejecutar({
      nombre: dto.nombre,
      presentacion: dto.presentacion,
    });
  }

  @Get()
  @RequirePermission('insumos.ver')
  @ApiOperation({ summary: 'Lista el catalogo de insumos con paginado y filtros' })
  listar(@Query() dto: ListarInsumosDto) {
    return this.listarInsumosUseCase.ejecutar({
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      busqueda: dto.q,
      presentacion: dto.presentacion,
    });
  }

  @Get(':id')
  @RequirePermission('insumos.ver')
  @ApiOperation({ summary: 'Obtiene un insumo del catalogo por id' })
  obtener(@Param('id', UUID_PIPE) id: string) {
    return this.obtenerInsumoUseCase.ejecutar(id);
  }

  @Patch(':id')
  @RequirePermission('insumos.catalogo.editar')
  @ApiOperation({ summary: 'Actualiza nombre y presentacion del insumo' })
  actualizar(
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: EditarInsumoDto,
  ) {
    return this.editarInsumoUseCase.ejecutar(id, {
      nombre: dto.nombre,
      presentacion: dto.presentacion,
    });
  }

  @Delete(':id')
  @RequirePermission('insumos.catalogo.editar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Borra un insumo que aun no tiene stock en ninguna sucursal',
  })
  async eliminar(@Param('id', UUID_PIPE) id: string): Promise<void> {
    await this.eliminarInsumoUseCase.ejecutar(id);
  }
}
