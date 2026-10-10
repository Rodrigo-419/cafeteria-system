import { Module } from '@nestjs/common';
import { GenerarReporteComparativoUseCase } from './application/use-cases/generar-reporte-comparativo.use-case';
import { ReportsRepository } from './infrastructure/reports.repository';
import { ReportsController } from './presentation/reports.controller';

@Module({
  controllers: [ReportsController],
  providers: [ReportsRepository, GenerarReporteComparativoUseCase],
})
export class ReportsModule {}
