// Controller HTTP de asignaciones de turno.
//
// Rutas planas bajo `/assignments`. No hay DELETE: retirar una asignacion es un
// PATCH que fija su fecha de fin. Todas las rutas piden el permiso de edicion de
// turnos, que tambien da la lectura.
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { User } from '../../../common/decorators/user.decorator';
import type { UsuarioAutenticado } from '../../auth/infrastructure/jwt/jwt.strategy';
import { CrearAsignacionUseCase } from '../application/use-cases/crear-asignacion.use-case';
import { ListarAsignacionesUseCase } from '../application/use-cases/listar-asignaciones.use-case';
import { RetirarAsignacionUseCase } from '../application/use-cases/retirar-asignacion.use-case';
import { aActorTurnos } from './actor-shifts';
import {
  CrearAsignacionDto,
  ListarAsignacionesDto,
  RetirarAsignacionDto,
} from './dto/shifts.dto';

const UUID_PIPE = new ParseUUIDPipe({ version: 'all' });

@Controller('assignments')
@ApiTags('assignments')
@ApiBearerAuth()
@RequirePermission('turnos.editar')
export class AssignmentsController {
  constructor(
    private readonly crearAsignacionUseCase: CrearAsignacionUseCase,
    private readonly listarAsignacionesUseCase: ListarAsignacionesUseCase,
    private readonly retirarAsignacionUseCase: RetirarAsignacionUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Asigna un turno a un empleado' })
  crear(@User() usuario: UsuarioAutenticado, @Body() dto: CrearAsignacionDto) {
    return this.crearAsignacionUseCase.ejecutar(aActorTurnos(usuario), {
      empleadoId: dto.empleadoId,
      turnoId: dto.turnoId,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Lista asignaciones con paginado y filtros' })
  listar(
    @User() usuario: UsuarioAutenticado,
    @Query() dto: ListarAsignacionesDto,
  ) {
    return this.listarAsignacionesUseCase.ejecutar(aActorTurnos(usuario), {
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      empleadoId: dto.empleadoId,
      turnoId: dto.turnoId,
      vigente: dto.vigente,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Retira una asignacion fijando su fecha de fin' })
  retirar(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: RetirarAsignacionDto,
  ) {
    return this.retirarAsignacionUseCase.ejecutar(aActorTurnos(usuario), id, {
      fechaFin: dto.fechaFin,
    });
  }
}
