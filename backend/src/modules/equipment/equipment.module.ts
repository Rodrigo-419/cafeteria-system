import { Module } from '@nestjs/common';
import { EquipmentController } from './equipment.controller';
import { EquipmentRepository } from './equipment.repository';
import { EquipmentService } from './equipment.service';

@Module({
  controllers: [EquipmentController],
  providers: [EquipmentRepository, EquipmentService],
  exports: [EquipmentRepository],
})
export class EquipmentModule {}
