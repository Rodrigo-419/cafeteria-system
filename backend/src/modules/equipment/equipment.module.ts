import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { EquipmentController } from './equipment.controller';
import { EquipmentRepository } from './equipment.repository';
import { EquipmentService } from './equipment.service';

@Module({
  imports: [AuditoriaModule],
  controllers: [EquipmentController],
  providers: [EquipmentRepository, EquipmentService],
  exports: [EquipmentRepository],
})
export class EquipmentModule {}
