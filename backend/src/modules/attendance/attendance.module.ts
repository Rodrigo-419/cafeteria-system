import { Module } from '@nestjs/common';
import { RegistroFallosPinService } from './application/registro-fallos-pin.service';
import { CorregirRegistroUseCase } from './application/use-cases/corregir-registro.use-case';
import { JustificarFaltaUseCase } from './application/use-cases/justificar-falta.use-case';
import { ListarEmpleadosTerminalUseCase } from './application/use-cases/listar-empleados-terminal.use-case';
import { ListarFaltasUseCase } from './application/use-cases/listar-faltas.use-case';
import { ListarRegistrosUseCase } from './application/use-cases/listar-registros.use-case';
import { MarcarAsistenciaUseCase } from './application/use-cases/marcar-asistencia.use-case';
import { ObtenerRegistroUseCase } from './application/use-cases/obtener-registro.use-case';
import { AttendanceRepository } from './infrastructure/attendance.repository';
import { AttendanceController } from './presentation/attendance.controller';

@Module({
  controllers: [AttendanceController],
  providers: [
    AttendanceRepository,
    RegistroFallosPinService,
    MarcarAsistenciaUseCase,
    CorregirRegistroUseCase,
    JustificarFaltaUseCase,
    ListarEmpleadosTerminalUseCase,
    ListarRegistrosUseCase,
    ObtenerRegistroUseCase,
    ListarFaltasUseCase,
  ],
})
export class AttendanceModule {}
