// Controller HTTP de los recuentos de inventario.
//
// Un recuento es el unico flujo que puede BAJAR el stock, y por eso necesita
// `inventario.recuento`: es un permiso aparte del de registrar entradas, que
// solo suma.
//
// El controller cuelga de `inventario` y no de una subruta fija porque conviven
// rutas con sucursal en el camino (`POST /inventario/sucursales/:id/recuentos`,
// donde el recuento se aplica a una sola sucursal) y rutas sin ella
// (`GET /inventario/recuentos`, que se acota por alcance).
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { User } from '../../../common/decorators/user.decorator';
import type { UsuarioAutenticado } from '../../auth/infrastructure/jwt/jwt.strategy';
import { CrearRecuentoUseCase } from '../application/use-cases/crear-recuento.use-case';
import { ListarRecuentosUseCase } from '../application/use-cases/listar-recuentos.use-case';
import { ObtenerRecuentoUseCase } from '../application/use-cases/obtener-recuento.use-case';
import { aActorInventario } from './actor-inventario';
import { CrearRecuentoDto, ListarRecuentosDto } from './dto/inventory.dto';

const UUID_PIPE = new ParseUUIDPipe({ version: 'all' });

@Controller('inventario')
@ApiTags('inventario-recuentos')
@ApiBearerAuth()
export class RecuentosController {
  constructor(
    private readonly crearRecuentoUseCase: CrearRecuentoUseCase,
    private readonly listarRecuentosUseCase: ListarRecuentosUseCase,
    private readonly obtenerRecuentoUseCase: ObtenerRecuentoUseCase,
  ) {}

  @Post('sucursales/:sucursalId/recuentos')
  @RequirePermission('inventario.recuento')
  @ApiOperation({
    summary: 'Registra un recuento fisico y ajusta el stock a lo contado',
    description:
      'Las lineas van por insumoId del catalogo, no por id de stock. Toda la operacion va en una transaccion con las filas bloqueadas: si algo falla, no queda recuento ni cambio de stock.',
  })
  crear(
    @User() usuario: UsuarioAutenticado,
    @Param('sucursalId', UUID_PIPE) sucursalId: string,
    @Body() dto: CrearRecuentoDto,
  ) {
    return this.crearRecuentoUseCase.ejecutar(aActorInventario(usuario), sucursalId, {
      items: dto.items.map((item) => ({
        insumoId: item.insumoId,
        stockFisico: item.stockFisico,
      })),
    });
  }

  @Get('recuentos')
  @RequirePermission('inventario.recuento')
  @ApiOperation({ summary: 'Lista recuentos, acotados al alcance del usuario' })
  listar(@User() usuario: UsuarioAutenticado, @Query() dto: ListarRecuentosDto) {
    return this.listarRecuentosUseCase.ejecutar(aActorInventario(usuario), {
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      sucursalId: dto.sucursalId,
    });
  }

  @Get('recuentos/:id')
  @RequirePermission('inventario.recuento')
  @ApiOperation({ summary: 'Detalle de un recuento con sus lineas' })
  obtener(@User() usuario: UsuarioAutenticado, @Param('id', UUID_PIPE) id: string) {
    return this.obtenerRecuentoUseCase.ejecutar(aActorInventario(usuario), id);
  }
}
