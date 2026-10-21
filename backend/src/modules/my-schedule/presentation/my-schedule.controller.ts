// Controlador HTTP del horario propio del empleado autenticado.
//
// La ruta exige solo autenticación (el mismo mecanismo que /auth/me): el
// PermissionsGuard pasa cuando no hay @RequirePermission. No añade ningún
// permiso nuevo — es una ruta personal, no de gestión.
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { User } from '../../../common/decorators/user.decorator';
import type { UsuarioAutenticado } from '../../auth/infrastructure/jwt/jwt.strategy';
import { MiHorarioUseCase } from '../application/use-cases/mi-horario.use-case';
import { EsFechaLocal } from '../../reports/presentation/dto/reports.dto';

/** Query de `GET /my/schedule`. `desde` y `hasta` son opcionales. */
class MiHorarioQueryDto {
  @IsOptional()
  @EsFechaLocal()
  desde?: string;

  @IsOptional()
  @EsFechaLocal()
  hasta?: string;
}

@Controller('my')
@ApiTags('mi-horario')
export class MyScheduleController {
  constructor(private readonly miHorarioUseCase: MiHorarioUseCase) {}

  @Get('schedule')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Horario del empleado vinculado al usuario autenticado',
  })
  obtenerHorario(
    @User() usuario: UsuarioAutenticado,
    @Query() query: MiHorarioQueryDto,
  ) {
    return this.miHorarioUseCase.ejecutar(usuario.id, {
      desde: query.desde,
      hasta: query.hasta,
    });
  }
}
