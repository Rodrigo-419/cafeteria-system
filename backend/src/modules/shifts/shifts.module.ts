import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { ActualizarTurnoUseCase } from './application/use-cases/actualizar-turno.use-case';
import { CrearAsignacionUseCase } from './application/use-cases/crear-asignacion.use-case';
import { CrearTurnoUseCase } from './application/use-cases/crear-turno.use-case';
import { ListarAsignacionesUseCase } from './application/use-cases/listar-asignaciones.use-case';
import { ListarTurnosUseCase } from './application/use-cases/listar-turnos.use-case';
import { ObtenerTurnoUseCase } from './application/use-cases/obtener-turno.use-case';
import { RetirarAsignacionUseCase } from './application/use-cases/retirar-asignacion.use-case';
import { ShiftsRepository } from './infrastructure/shifts.repository';
import { AssignmentsController } from './presentation/assignments.controller';
import { ShiftsController } from './presentation/shifts.controller';

@Module({
  imports: [EmployeesModule],
  controllers: [ShiftsController, AssignmentsController],
  providers: [
    ShiftsRepository,
    CrearTurnoUseCase,
    ListarTurnosUseCase,
    ObtenerTurnoUseCase,
    ActualizarTurnoUseCase,
    CrearAsignacionUseCase,
    ListarAsignacionesUseCase,
    RetirarAsignacionUseCase,
  ],
  exports: [ShiftsRepository],
})
export class ShiftsModule {}
