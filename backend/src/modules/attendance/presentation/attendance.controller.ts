// Controller HTTP de asistencia.
//
// Rutas planas bajo `/attendance`. Los permisos se declaran por ruta porque el
// modulo mezcla tres: `asistencia.marcar` (terminal y marcacion),
// `asistencia.corregir` (correcciones y justificaciones) y `asistencia.ver`
// (lecturas). El alcance se aplica siempre dentro de los casos de uso.
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { User } from '../../../common/decorators/user.decorator';
import type { UsuarioAutenticado } from '../../auth/infrastructure/jwt/jwt.strategy';
import { CorregirRegistroUseCase } from '../application/use-cases/corregir-registro.use-case';
import { JustificarFaltaUseCase } from '../application/use-cases/justificar-falta.use-case';
import { ListarEmpleadosTerminalUseCase } from '../application/use-cases/listar-empleados-terminal.use-case';
import { ListarFaltasUseCase } from '../application/use-cases/listar-faltas.use-case';
import { ListarRegistrosUseCase } from '../application/use-cases/listar-registros.use-case';
import { MarcarAsistenciaUseCase } from '../application/use-cases/marcar-asistencia.use-case';
import { ObtenerRegistroUseCase } from '../application/use-cases/obtener-registro.use-case';
import { aActorAsistencia } from './actor-asistencia';
import {
  CorregirRegistroDto,
  JustificarFaltaDto,
  ListarFaltasDto,
  ListarRegistrosDto,
  MarcarAsistenciaDto,
} from './dto/attendance.dto';

const UUID_PIPE = new ParseUUIDPipe({ version: 'all' });

/** Convierte un texto ISO 8601 en `Date` o responde 400. */
function interpretarInstante(valor: string): Date {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new BadRequestException(
      'La fecha y hora debe tener formato ISO 8601',
    );
  }
  return fecha;
}

@Controller('attendance')
@ApiTags('attendance')
@ApiBearerAuth()
export class AttendanceController {
  constructor(
    private readonly marcarAsistenciaUseCase: MarcarAsistenciaUseCase,
    private readonly corregirRegistroUseCase: CorregirRegistroUseCase,
    private readonly justificarFaltaUseCase: JustificarFaltaUseCase,
    private readonly listarEmpleadosTerminalUseCase: ListarEmpleadosTerminalUseCase,
    private readonly listarRegistrosUseCase: ListarRegistrosUseCase,
    private readonly obtenerRegistroUseCase: ObtenerRegistroUseCase,
    private readonly listarFaltasUseCase: ListarFaltasUseCase,
  ) {}

  @Post('mark')
  @RequirePermission('asistencia.marcar')
  @ApiOperation({ summary: 'Registra una marcacion de entrada o salida' })
  marcar(
    @User() usuario: UsuarioAutenticado,
    @Body() dto: MarcarAsistenciaDto,
  ) {
    return this.marcarAsistenciaUseCase.ejecutar(aActorAsistencia(usuario), {
      empleadoId: dto.empleadoId,
      tipo: dto.tipo,
      pin: dto.pin,
    });
  }

  @Get('terminal/employees')
  @RequirePermission('asistencia.marcar')
  @ApiOperation({ summary: 'Lista los empleados activos de la sucursal' })
  terminal(@User() usuario: UsuarioAutenticado) {
    return this.listarEmpleadosTerminalUseCase.ejecutar(
      aActorAsistencia(usuario),
    );
  }

  @Post('records/:id/correct')
  @RequirePermission('asistencia.corregir')
  @ApiOperation({ summary: 'Corrige un registro de asistencia' })
  corregir(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: CorregirRegistroDto,
  ) {
    return this.corregirRegistroUseCase.ejecutar(aActorAsistencia(usuario), id, {
      motivo: dto.motivo,
      fechaHora: interpretarInstante(dto.fechaHora),
      tipo: dto.tipo,
    });
  }

  @Post('absences/justify')
  @RequirePermission('asistencia.corregir')
  @ApiOperation({ summary: 'Justifica la falta de un empleado' })
  justificar(
    @User() usuario: UsuarioAutenticado,
    @Body() dto: JustificarFaltaDto,
  ) {
    return this.justificarFaltaUseCase.ejecutar(aActorAsistencia(usuario), {
      empleadoId: dto.empleadoId,
      fecha: dto.fecha,
      motivo: dto.motivo,
    });
  }

  @Get('records')
  @RequirePermission('asistencia.ver')
  @ApiOperation({ summary: 'Lista registros efectivos de asistencia' })
  listar(
    @User() usuario: UsuarioAutenticado,
    @Query() dto: ListarRegistrosDto,
  ) {
    return this.listarRegistrosUseCase.ejecutar(aActorAsistencia(usuario), {
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      empleadoId: dto.empleadoId,
      sucursalId: dto.sucursalId,
      desde: dto.desde,
      hasta: dto.hasta,
      abierta: dto.abierta,
    });
  }

  @Get('records/:id')
  @RequirePermission('asistencia.ver')
  @ApiOperation({ summary: 'Obtiene un registro con sus correcciones' })
  obtener(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.obtenerRegistroUseCase.ejecutar(aActorAsistencia(usuario), id);
  }

  @Get('absences')
  @RequirePermission('asistencia.ver')
  @ApiOperation({ summary: 'Lista faltas de un rango de dias' })
  faltas(
    @User() usuario: UsuarioAutenticado,
    @Query() dto: ListarFaltasDto,
  ) {
    return this.listarFaltasUseCase.ejecutar(aActorAsistencia(usuario), {
      desde: dto.desde,
      hasta: dto.hasta,
      empleadoId: dto.empleadoId,
      sucursalId: dto.sucursalId,
    });
  }
}