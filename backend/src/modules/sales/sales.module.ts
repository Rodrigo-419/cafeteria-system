import { Module } from '@nestjs/common';
import { AnularVentaUseCase } from './application/use-cases/anular-venta.use-case';
import { ListarVentasUseCase } from './application/use-cases/listar-ventas.use-case';
import { ObtenerVentaUseCase } from './application/use-cases/obtener-venta.use-case';
import { RegistrarVentaUseCase } from './application/use-cases/registrar-venta.use-case';
import { SalesRepository } from './infrastructure/sales.repository';
import { SalesController } from './presentation/sales.controller';

@Module({
  controllers: [SalesController],
  providers: [
    SalesRepository,
    RegistrarVentaUseCase,
    AnularVentaUseCase,
    ListarVentasUseCase,
    ObtenerVentaUseCase,
  ],
})
export class SalesModule {}
