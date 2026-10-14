// Modulo de auditoria.
//
// Exporta `AuditoriaRepository` para que los modulos que escriben (users,
// employees, ...) puedan registrar eventos dentro de su propia transaccion.
import { Module } from '@nestjs/common';
import { HistorialUsuarioUseCase } from './application/historial-usuario.use-case';
import { ListarAuditoriaUseCase } from './application/listar-auditoria.use-case';
import { AuditoriaRepository } from './infrastructure/auditoria.repository';
import { AuditoriaController } from './presentation/auditoria.controller';

@Module({
  controllers: [AuditoriaController],
  providers: [
    AuditoriaRepository,
    ListarAuditoriaUseCase,
    HistorialUsuarioUseCase,
  ],
  exports: [AuditoriaRepository],
})
export class AuditoriaModule {}
