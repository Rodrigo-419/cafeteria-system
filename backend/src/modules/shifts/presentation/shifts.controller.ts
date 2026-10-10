// Controller HTTP de turnos.
//
// Rutas planas bajo `/shifts`. La sucursal es un filtro opcional en el listado
// (el Gerente siempre queda limitado a la suya por alcance) y no aparece en el
// camino. Todas las rutas piden el mismo permiso de edicion, que tambien da la
// lectura, siguiendo el patron del resto de modulos.
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
import { ActualizarTurnoUseCase } from '../application/use-cases/actualizar-turno.use-case';
import { CrearTurnoUseCase } from '../application/use-cases/crear-turno.use-case';
import { ListarTurnosUseCase } from '../application/use-cases/listar-turnos.use-case';
import { ObtenerTurnoUseCase } from '../application/use-cases/obtener-turno.use-case';
import { aActorTurnos } from './actor-shifts';
import {
  ActualizarTurnoDto,
  CrearTurnoDto,
  ListarTurnosDto,
} from './dto/shifts.dto';

const UUID_PIPE = new ParseUUIDPipe({ version: 'all' });

@Controller('shifts')
@ApiTags('shifts')
@ApiBearerAuth()
@RequirePermission('turnos.editar')
export class ShiftsController {
  constructor(
    private readonly crearTurnoUseCase: CrearTurnoUseCase,
    private readonly listarTurnosUseCase: ListarTurnosUseCase,
    private readonly obtenerTurnoUseCase: ObtenerTurnoUseCase,
    private readonly actualizarTurnoUseCase: ActualizarTurnoUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crea un turno fijo o variable' })
  crear(@User() usuario: UsuarioAutenticado, @Body() dto: CrearTurnoDto) {
    return this.crearTurnoUseCase.ejecutar(aActorTurnos(usuario), {
      sucursalId: dto.sucursalId,
      tipo: dto.tipo,
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
      diasSemana: dto.diasSemana,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Lista turnos con paginado y filtros' })
  listar(@User() usuario: UsuarioAutenticado, @Query() dto: ListarTurnosDto) {
    return this.listarTurnosUseCase.ejecutar(aActorTurnos(usuario), {
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      sucursalId: dto.sucursalId,
      tipo: dto.tipo,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un turno por id' })
  obtener(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.obtenerTurnoUseCase.ejecutar(aActorTurnos(usuario), id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza las horas y los dias de un turno' })
  actualizar(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: ActualizarTurnoDto,
  ) {
    return this.actualizarTurnoUseCase.ejecutar(aActorTurnos(usuario), id, {
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
      diasSemana: dto.diasSemana,
    });
  }
}
