import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ActualizarEmpleadoUseCase } from './application/use-cases/actualizar-empleado.use-case';
import { CesarEmpleadoUseCase } from './application/use-cases/cesar-empleado.use-case';
import { CrearEmpleadoUseCase } from './application/use-cases/crear-empleado.use-case';
import { ListarEmpleadosUseCase } from './application/use-cases/listar-empleados.use-case';
import { ObtenerEmpleadoUseCase } from './application/use-cases/obtener-empleado.use-case';
import { RegenerarPinUseCase } from './application/use-cases/regenerar-pin.use-case';
import { EmployeesRepository } from './infrastructure/employees.repository';
import { EmployeesController } from './presentation/employees.controller';

@Module({
  imports: [UsersModule],
  controllers: [EmployeesController],
  providers: [
    EmployeesRepository,
    CrearEmpleadoUseCase,
    ListarEmpleadosUseCase,
    ObtenerEmpleadoUseCase,
    ActualizarEmpleadoUseCase,
    CesarEmpleadoUseCase,
    RegenerarPinUseCase,
  ],
  exports: [EmployeesRepository],
})
export class EmployeesModule {}
