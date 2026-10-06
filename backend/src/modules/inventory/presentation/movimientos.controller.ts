// Controller HTTP del historial de movimientos de stock.
//
// El movimiento registra la VARIACION del stock (cuanto entro o se ajusto), no
// el valor final. Para el valor actual esta el endpoint de stock.
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { User } from '../../../common/decorators/user.decorator';
import type { UsuarioAutenticado } from '../../auth/infrastructure/jwt/jwt.strategy';
import { ListarMovimientosUseCase } from '../application/use-cases/listar-movimientos.use-case';
import { aActorInventario } from './actor-inventario';
import { ListarMovimientosDto } from './dto/inventory.dto';

const UUID_PIPE = new ParseUUIDPipe({ version: 'all' });

@Controller('inventario/sucursales/:sucursalId/movimientos')
@ApiTags('inventario-movimientos')
@ApiBearerAuth()
export class MovimientosController {
  constructor(private readonly listarMovimientosUseCase: ListarMovimientosUseCase) {}

  @Get()
  @RequirePermission('inventario.registrar')
  @ApiOperation({
    summary: 'Historial de movimientos de stock de la sucursal',
    description:
      'Siempre acotado a la sucursal de la ruta. Sin filtro de insumo devuelve el historial completo de esa sucursal.',
  })
  listar(
    @User() usuario: UsuarioAutenticado,
    @Param('sucursalId', UUID_PIPE) sucursalId: string,
    @Query() dto: ListarMovimientosDto,
  ) {
    return this.listarMovimientosUseCase.ejecutar(aActorInventario(usuario), sucursalId, {
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      insumoId: dto.insumoId,
      tipo: dto.tipo,
      desde: dto.desde,
      hasta: dto.hasta,
    });
  }
}
