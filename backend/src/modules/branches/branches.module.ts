import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { BranchesController } from './branches.controller';
import { BranchesRepository } from './branches.repository';
import { BranchesService } from './branches.service';

@Module({
  imports: [AuditoriaModule],
  controllers: [BranchesController],
  providers: [BranchesRepository, BranchesService],
  exports: [BranchesRepository],
})
export class BranchesModule {}
