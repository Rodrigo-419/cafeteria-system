import { Module } from '@nestjs/common';
import { ConfigurarStockUseCase } from './application/use-cases/configurar-stock.use-case';
import { CrearInsumoUseCase } from './application/use-cases/crear-insumo.use-case';
import { CrearRecuentoUseCase } from './application/use-cases/crear-recuento.use-case';
import { EditarInsumoUseCase } from './application/use-cases/editar-insumo.use-case';
import { EliminarInsumoUseCase } from './application/use-cases/eliminar-insumo.use-case';
import { ListarAlertasUseCase } from './application/use-cases/listar-alertas.use-case';
import { ListarInsumosUseCase } from './application/use-cases/listar-insumos.use-case';
import { ListarMovimientosUseCase } from './application/use-cases/listar-movimientos.use-case';
import { ListarRecuentosUseCase } from './application/use-cases/listar-recuentos.use-case';
import { ListarStockUseCase } from './application/use-cases/listar-stock.use-case';
import { ObtenerInsumoUseCase } from './application/use-cases/obtener-insumo.use-case';
import { ObtenerRecuentoUseCase } from './application/use-cases/obtener-recuento.use-case';
import { ReevaluarAlertasService } from './application/use-cases/reevaluar-alertas.service';
import { RegistrarEntradaUseCase } from './application/use-cases/registrar-entrada.use-case';
import { InventoryRepository } from './infrastructure/inventory.repository';
import { AlertasController } from './presentation/alertas.controller';
import { InsumosController } from './presentation/insumos.controller';
import { InventarioStockController } from './presentation/inventario-stock.controller';
import { MovimientosController } from './presentation/movimientos.controller';
import { RecuentosController } from './presentation/recuentos.controller';

@Module({
  controllers: [
    InsumosController,
    InventarioStockController,
    MovimientosController,
    RecuentosController,
    AlertasController,
  ],
  providers: [
    InventoryRepository,
    // Catalogo de insumos (global).
    CrearInsumoUseCase,
    EditarInsumoUseCase,
    EliminarInsumoUseCase,
    ObtenerInsumoUseCase,
    ListarInsumosUseCase,
    // Stock por sucursal.
    ListarStockUseCase,
    ConfigurarStockUseCase,
    RegistrarEntradaUseCase,
    ListarMovimientosUseCase,
    // Recuentos.
    CrearRecuentoUseCase,
    ListarRecuentosUseCase,
    ObtenerRecuentoUseCase,
    // Alertas.
    ListarAlertasUseCase,
    // Lo comparten los tres flujos que mueven el stock, asi que va registrado
    // como provider propio en vez de inyectarse caso por caso.
    ReevaluarAlertasService,
  ],
  exports: [InventoryRepository],
})
export class InventoryModule {}
