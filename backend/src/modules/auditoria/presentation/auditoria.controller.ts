// Controller HTTP de auditoria (solo lectura).
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { User } from '../../../common/decorators/user.decorator';
import type { UsuarioAutenticado } from '../../auth/infrastructure/jwt/jwt.strategy';
import { ActorAuditoria } from '../application/alcance-auditoria';
import { HistorialUsuarioUseCase } from '../application/historial-usuario.use-case';
import { ListarAuditoriaUseCase } from '../application/listar-auditoria.use-case';
import {
  HistorialUsuarioDto,
  ListarAuditoriaDto,
} from './dto/auditoria.dto';

const UUID_PIPE = new ParseUUIDPipe({ version: undefined });

@Controller('auditoria')
@ApiTags('auditoria')
@ApiBearerAuth()
export class AuditoriaController {
  constructor(
    private readonly listarAuditoriaUseCase: ListarAuditoriaUseCase,
    private readonly historialUsuarioUseCase: HistorialUsuarioUseCase,
  ) {}

  @Get()
  @RequirePermission('usuarios.crear_editar')
  @ApiOperation({ summary: 'Lista eventos de auditoria con filtros y paginado' })
  listar(
    @User() usuario: UsuarioAutenticado,
    @Query() dto: ListarAuditoriaDto,
  ) {
    return this.listarAuditoriaUseCase.ejecutar(aActorAuditoria(usuario), {
      page: dto.page ?? 1,
      limit: dto.limit ?? 20,
      actorId: dto.actorId,
      entidad: dto.entidad,
      entidadId: dto.entidadId,
      accion: dto.accion,
      sucursalId: dto.sucursalId,
      desde: dto.desde,
      hasta: dto.hasta,
    });
  }

  @Get('usuarios/:usuarioId')
  @RequirePermission('usuarios.crear_editar')
  @ApiOperation({ summary: 'Historial de auditoria de un usuario' })
  historial(
    @User() usuario: UsuarioAutenticado,
    @Param('usuarioId', UUID_PIPE) usuarioId: string,
    @Query() dto: HistorialUsuarioDto,
  ) {
    return this.historialUsuarioUseCase.ejecutar(
      aActorAuditoria(usuario),
      usuarioId,
      { page: dto.page ?? 1, limit: dto.limit ?? 20 },
    );
  }
}

/** Reduce `request.user` al recorte minimo que exige el alcance de auditoria. */
function aActorAuditoria(usuario: UsuarioAutenticado): ActorAuditoria {
  return {
    id: usuario.id,
    rol: usuario.rol,
    sucursalId: usuario.sucursalId,
  };
}
