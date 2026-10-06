// Controller HTTP de las alertas de stock.
//
// Solo hay listado. No hay forma de abrir ni de cerrar una alerta a mano: se
// abren y se cierran solas cuando cambia el stock, el minimo o el estado, dentro
// de la transaccion que hizo ese cambio. El permiso se llama `ver_resolver` para
// dejar constancia de esa intencion de diseño, aunque este controller solo lea.
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { User } from '../../../common/decorators/user.decorator';
import type { UsuarioAutenticado } from '../../auth/infrastructure/jwt/jwt.strategy';
import { ListarAlertasUseCase } from '../application/use-cases/listar-alertas.use-case';
import { aActorInventario } from './actor-inventario';
import { ListarAlertasDto } from './dto/inventory.dto';

@Controller('inventario/alertas')
@ApiTags('inventario-alertas')
@ApiBearerAuth()
export class AlertasController {
  constructor(private readonly listarAlertasUseCase: ListarAlertasUseCase) {}

  @Get()
  @RequirePermission('alertas.ver_resolver')
  @ApiOperation({
    summary: 'Lista alertas de stock, acotadas al alcance del usuario',
    description:
      'Sin filtro de sucursal un Gerente ve solo las de la suya y un Admin las de todas. Cada alerta trae el stock actual y el minimo en el momento de la consulta.',
  })
  listar(@User() usuario: UsuarioAutenticado, @Query() dto: ListarAlertasDto) {
    return this.listarAlertasUseCase.ejecutar(aActorInventario(usuario), {
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      sucursalId: dto.sucursalId,
      estado: dto.estado,
    });
  }
}
