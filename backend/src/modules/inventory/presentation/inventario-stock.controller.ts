// Controller HTTP del stock por sucursal.
//
// Todas las rutas llevan el id de sucursal en el camino, porque el stock siempre
// es "de este insumo, en esta sucursal". El alcance lo comprueba el caso de uso:
// una sucursal ajena se responde 404, no 403.
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { User } from '../../../common/decorators/user.decorator';
import type { UsuarioAutenticado } from '../../auth/infrastructure/jwt/jwt.strategy';
import { ConfigurarStockUseCase } from '../application/use-cases/configurar-stock.use-case';
import { ListarStockUseCase } from '../application/use-cases/listar-stock.use-case';
import { RegistrarEntradaUseCase } from '../application/use-cases/registrar-entrada.use-case';
import { aActorInventario } from './actor-inventario';
import {
  ConfigurarStockDto,
  ListarStockDto,
  RegistrarEntradaDto,
} from './dto/inventory.dto';

const UUID_PIPE = new ParseUUIDPipe({ version: 'all' });

@Controller('inventario/sucursales/:sucursalId')
@ApiTags('inventario-stock')
@ApiBearerAuth()
export class InventarioStockController {
  constructor(
    private readonly listarStockUseCase: ListarStockUseCase,
    private readonly configurarStockUseCase: ConfigurarStockUseCase,
    private readonly registrarEntradaUseCase: RegistrarEntradaUseCase,
  ) {}

  @Get('stock')
  @RequirePermission('insumos.ver')
  @ApiOperation({
    summary: 'Lista el stock de la sucursal, con filtro de bajo minimo',
  })
  listar(
    @User() usuario: UsuarioAutenticado,
    @Param('sucursalId', UUID_PIPE) sucursalId: string,
    @Query() dto: ListarStockDto,
  ) {
    return this.listarStockUseCase.ejecutar(aActorInventario(usuario), sucursalId, {
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      estado: dto.estado,
      soloBajoMinimo: dto.soloBajoMinimo,
      busqueda: dto.q,
    });
  }

  @Put('insumos/:insumoId')
  @RequirePermission('inventario.minimo.editar')
  @ApiOperation({
    summary: 'Da de alta el insumo en la sucursal y ajusta su stock minimo y estado',
  })
  configurar(
    @User() usuario: UsuarioAutenticado,
    @Param('sucursalId', UUID_PIPE) sucursalId: string,
    @Param('insumoId', UUID_PIPE) insumoId: string,
    @Body() dto: ConfigurarStockDto,
  ) {
    return this.configurarStockUseCase.ejecutar(aActorInventario(usuario), sucursalId, insumoId, {
      stockMinimo: dto.stockMinimo,
      estado: dto.estado,
    });
  }

  @Post('insumos/:insumoId/entradas')
  @RequirePermission('inventario.registrar')
  @ApiOperation({
    summary: 'Registra una entrada: suma la cantidad al stock y guarda el movimiento',
  })
  registrarEntrada(
    @User() usuario: UsuarioAutenticado,
    @Param('sucursalId', UUID_PIPE) sucursalId: string,
    @Param('insumoId', UUID_PIPE) insumoId: string,
    @Body() dto: RegistrarEntradaDto,
  ) {
    return this.registrarEntradaUseCase.ejecutar(aActorInventario(usuario), sucursalId, insumoId, {
      cantidad: dto.cantidad,
      motivo: dto.motivo,
    });
  }
}
