// Controller HTTP del personal.
//
// Rutas planas bajo `/employees`: el empleado ya pertenece a una sucursal por su
// usuario vinculado, asi que la sucursal no va en el camino. En los listados es
// un filtro opcional para que un Admin pueda mirar solo una.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { ActualizarEmpleadoUseCase } from '../application/use-cases/actualizar-empleado.use-case';
import { CesarEmpleadoUseCase } from '../application/use-cases/cesar-empleado.use-case';
import { CrearEmpleadoUseCase } from '../application/use-cases/crear-empleado.use-case';
import { ListarEmpleadosUseCase } from '../application/use-cases/listar-empleados.use-case';
import { ObtenerEmpleadoUseCase } from '../application/use-cases/obtener-empleado.use-case';
import { RegenerarPinUseCase } from '../application/use-cases/regenerar-pin.use-case';
import { aActorEmpleados } from './actor-empleados';
import {
  ActualizarEmpleadoDto,
  CesarEmpleadoDto,
  CrearEmpleadoDto,
  ListarEmpleadosDto,
} from './dto/employees.dto';

const UUID_PIPE = new ParseUUIDPipe({ version: 'all' });

@Controller('employees')
@ApiTags('employees')
@ApiBearerAuth()
export class EmployeesController {
  constructor(
    private readonly crearEmpleadoUseCase: CrearEmpleadoUseCase,
    private readonly listarEmpleadosUseCase: ListarEmpleadosUseCase,
    private readonly obtenerEmpleadoUseCase: ObtenerEmpleadoUseCase,
    private readonly actualizarEmpleadoUseCase: ActualizarEmpleadoUseCase,
    private readonly cesarEmpleadoUseCase: CesarEmpleadoUseCase,
    private readonly regenerarPinUseCase: RegenerarPinUseCase,
  ) {}

  @Post()
  @RequirePermission('empleados.crear_editar')
  @ApiOperation({ summary: 'Registra un empleado a partir de un usuario' })
  crear(@User() usuario: UsuarioAutenticado, @Body() dto: CrearEmpleadoDto) {
    return this.crearEmpleadoUseCase.ejecutar(aActorEmpleados(usuario), {
      usuarioId: dto.usuarioId,
      cargo: dto.cargo,
      fechaContratacion: dto.fechaContratacion,
      sucursalId: dto.sucursalId,
    });
  }

  @Get()
  @RequirePermission('empleados.crear_editar')
  @ApiOperation({ summary: 'Lista empleados con paginado y filtros' })
  listar(@User() usuario: UsuarioAutenticado, @Query() dto: ListarEmpleadosDto) {
    return this.listarEmpleadosUseCase.ejecutar(aActorEmpleados(usuario), {
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      sucursalId: dto.sucursalId,
      estado: dto.estado,
      q: dto.q,
    });
  }

  @Get(':id')
  @RequirePermission('empleados.crear_editar')
  @ApiOperation({ summary: 'Obtiene un empleado por id' })
  obtener(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.obtenerEmpleadoUseCase.ejecutar(aActorEmpleados(usuario), id);
  }

  @Patch(':id')
  @RequirePermission('empleados.crear_editar')
  @ApiOperation({ summary: 'Actualiza el cargo de un empleado' })
  actualizar(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: ActualizarEmpleadoDto,
  ) {
    return this.actualizarEmpleadoUseCase.ejecutar(
      aActorEmpleados(usuario),
      id,
      { cargo: dto.cargo },
    );
  }

  @Post(':id/cese')
  @RequirePermission('empleados.crear_editar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cesa a un empleado y bloquea su cuenta' })
  cesar(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: CesarEmpleadoDto,
  ) {
    return this.cesarEmpleadoUseCase.ejecutar(aActorEmpleados(usuario), id, {
      fechaCese: dto.fechaCese,
    });
  }

  @Post(':id/pin')
  @RequirePermission('empleados.crear_editar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenera el PIN de marcacion de un empleado' })
  regenerarPin(
    @User() usuario: UsuarioAutenticado,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.regenerarPinUseCase.ejecutar(aActorEmpleados(usuario), id);
  }
}
