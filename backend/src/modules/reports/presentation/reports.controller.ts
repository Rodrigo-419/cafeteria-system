// Controller HTTP de reportes.
//
// Una sola ruta de solo lectura: `GET /reports/comparativo`. El permiso
// `reportes.comparativos.ver` lo tiene solo el Admin, asi que Gerente y
// Empleado reciben 403 y una peticion sin token recibe 401 por el guard global.
// La validacion del rango (orden y tope de 92 dias) vive en el caso de uso.
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { GenerarReporteComparativoUseCase } from '../application/use-cases/generar-reporte-comparativo.use-case';
import { ReporteComparativoQueryDto } from './dto/reports.dto';

@Controller('reports')
@ApiTags('reports')
@ApiBearerAuth()
export class ReportsController {
  constructor(
    private readonly generarReporteComparativoUseCase: GenerarReporteComparativoUseCase,
  ) {}

  @Get('comparativo')
  @RequirePermission('reportes.comparativos.ver')
  @ApiOperation({
    summary: 'Compara ventas, inventario y asistencia entre sucursales',
  })
  comparativo(@Query() dto: ReporteComparativoQueryDto) {
    return this.generarReporteComparativoUseCase.ejecutar({
      desde: dto.desde,
      hasta: dto.hasta,
      sucursalId: dto.sucursalId,
    });
  }
}
