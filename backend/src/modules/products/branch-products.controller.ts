// Controller HTTP de la carta y los precios por sucursal.
//
// Ruta con el id de sucursal en el camino, porque el precio siempre es "de este
// producto, de esta variante, en esta sucursal".
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { User } from '../../common/decorators/user.decorator';
import type { UsuarioAutenticado } from '../auth/infrastructure/jwt/jwt.strategy';
import { OfertasService } from './ofertas.service';
import type { ActorProductos } from './products.rules';
import { ListarCartaDto, UpsertOfertaDto } from './dto/ofertas.dto';

const UUID_PIPE = new ParseUUIDPipe({ version: 'all' });

@Controller('branches/:sucursalId/products')
@ApiTags('branch-products')
@ApiBearerAuth()
export class BranchProductsController {
  constructor(private readonly ofertasService: OfertasService) {}

  @Get()
  @RequirePermission('productos.ver')
  @ApiOperation({
    summary: 'Carta de la sucursal: producto, categoria, variante, precio y estado',
  })
  carta(
    @User() usuario: UsuarioAutenticado,
    @Param('sucursalId', UUID_PIPE) sucursalId: string,
    @Query() dto: ListarCartaDto,
  ) {
    return this.ofertasService.carta(aActor(usuario), sucursalId, {
      estado: dto.estado,
    });
  }

  @Put(':productoId/variants/:varianteId')
  @RequirePermission('productos.precio.editar')
  @ApiOperation({
    summary: 'Crea o actualiza el precio y el estado de una variante en la sucursal',
  })
  upsert(
    @User() usuario: UsuarioAutenticado,
    @Param('sucursalId', UUID_PIPE) sucursalId: string,
    @Param('productoId', UUID_PIPE) productoId: string,
    @Param('varianteId', UUID_PIPE) varianteId: string,
    @Body() dto: UpsertOfertaDto,
  ) {
    return this.ofertasService.upsert(aActor(usuario), {
      sucursalId,
      productoId,
      varianteId,
      precio: dto.precio,
      estado: dto.estado,
    });
  }
}

function aActor(usuario: UsuarioAutenticado): ActorProductos {
  return {
    id: usuario.id,
    rol: usuario.rol,
    sucursalId: usuario.sucursalId,
  };
}
