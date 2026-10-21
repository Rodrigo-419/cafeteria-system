// Módulo del horario propio del empleado autenticado.
//
// No exige ningún permiso de la matriz (es una ruta personal, igual que
// /auth/me). Reutiliza los repositorios de empleados, turnos y sucursales para
// resolver el empleado vinculado y sus asignaciones.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BranchesModule } from '../branches/branches.module';
import { EmployeesModule } from '../employees/employees.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { MiHorarioUseCase } from './application/use-cases/mi-horario.use-case';
import { MyScheduleController } from './presentation/my-schedule.controller';

@Module({
  imports: [AuthModule, EmployeesModule, ShiftsModule, BranchesModule],
  controllers: [MyScheduleController],
  providers: [MiHorarioUseCase],
})
export class MyScheduleModule {}
