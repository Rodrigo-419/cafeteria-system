import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { LIMITES_EXPORT, ExportsService } from './exports.service';
import { LIMITES_EXPORT_POR_DEFECTO } from './domain/limites';
import { PrismaModule } from '../../database/prisma.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [PrismaModule, AuditoriaModule],
  controllers: [ExportsController],
  providers: [
    ExportsService,
    {
      provide: LIMITES_EXPORT,
      useValue: LIMITES_EXPORT_POR_DEFECTO,
    },
  ],
  exports: [ExportsService],
})
export class ExportsModule {}
