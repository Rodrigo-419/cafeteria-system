// Controller HTTP de las ventas.
//
// Rutas planas bajo `/sales`: la sucursal no va en el camino porque una venta se
// registra desde la sucursal en la que esta el cajero (`request.user`), no desde
// una que elija el cliente. En los listados y en la lectura la sucursal es un
// filtro opcional que el Admin puede usar para mirar solo una.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { User } from '../../../common/decorators/user.decorator';
import type { UsuarioAutenticado } from '../../auth/infrastructure/jwt/jwt.strategy';
import { AnularVentaUseCase } from '../application/use-cases/anular-venta.use-case';
import { ListarVentasUseCase } from '../application/use-cases/listar-ventas.use-case';
import { ObtenerVentaUseCase } from '../application/use-cases/obtener-venta.use-case';
import { RegistrarVentaUseCase } from '../application/use-cases/registrar-venta.use-case';
import { aActorVentas } from './actor-ventas';
import {
  AnularVentaDto,
  ListarVentasDto,
  RegistrarVentaDto,
} from './dto/sales.dto';

const UUID_PIPE = new ParseUUIDPipe({ version: 'all' });

@Controller('sales')
@ApiTags('sales')
@ApiBearerAuth()
export class SalesController {
  constructor(
    private readonly registrarVentaUseCase: RegistrarVentaUseCase,
    private readonly anularVentaUseCase: AnularVentaUseCase,
    private readonly listarVentasUseCase: ListarVentasUseCase,
    private readonly obtenerVentaUseCase: ObtenerVentaUseCase,
  ) {}

  @Post()
  @RequirePermission('ventas.registrar')
  @ApiOperation({ summary: 'Registra una venta en la sucursal del usuario' })
  registrar(@User() usuario: UsuarioAutenticado, @Body() dto: RegistrarVentaDto) {
    return this.registrarVentaUseCase.ejecutar(aActorVentas(usuario), {
      metodoPago: dto.metodoPago,
      items: dto.items,
    });
  }

  @Get()
  @RequirePermission('ventas.ver')
  @ApiOperation({ summary: 'Lista ventas con paginado, filtros y totales' })
  listar(@User() usuario: UsuarioAutenticado, @Query() dto: ListarVentasDto) {
    return this.listarVentasUseCase.ejecutar(aActorVentas(usuario), {
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      sucursalId: dto.sucursalId,
      estado: dto.estado,
      metodoPago: dto.metodoPago,
      fecha: dto.fecha,
    });
  }

  @Get(':id')
  @RequirePermission('ventas.ver')
  @ApiOperation({ summary: 'Obtiene una venta con sus lineas' })
  obtener(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.obtenerVentaUseCase.ejecutar(aActorVentas(usuario), id);
  }

  @Post(':id/anular')
  @RequirePermission('ventas.anular')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anula una venta del mismo dia, con motivo' })
  anular(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: AnularVentaDto,
  ) {
    return this.anularVentaUseCase.ejecutar(aActorVentas(usuario), id, dto.motivo);
  }
}
