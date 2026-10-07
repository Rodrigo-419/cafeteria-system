import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../auth/presentation/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  ActualizarEquipoDto,
  CrearEquipoDto,
  FiltrosEquiposDto,
  FiltrosHistorialEquipoDto,
} from './dto/equipment.dto';
import { EquipmentService } from './equipment.service';
import type { Request } from 'express';

@ApiTags('equipment')
@ApiBearerAuth()
@Controller('equipment')
@UseGuards(PermissionsGuard)
export class EquipmentController {
  constructor(private readonly service: EquipmentService) {}

  private actor(req: Request) {
    return req.user as { id: string; rol: string | null; sucursalId: string | null; permisos: string[] };
  }

  @Post()
  @RequirePermission('equipo.registrar_editar')
  crear(@Req() req: Request, @Body() dto: CrearEquipoDto) {
    return this.service.crear(this.actor(req), {
      sucursalId: dto.sucursalId,
      nombre: dto.nombre,
      tipo: dto.tipo,
      observaciones: dto.observaciones ?? null,
    });
  }

  @Patch(':id')
  @RequirePermission('equipo.registrar_editar')
  actualizar(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: 'all' })) id: string,
    @Body() dto: ActualizarEquipoDto,
  ) {
    return this.service.actualizar(this.actor(req), id, {
      nombre: dto.nombre,
      tipo: dto.tipo,
      estado: dto.estado as any,
      observaciones: dto.observaciones,
    });
  }

  @Get()
  @RequirePermission('equipo.ver')
  listar(@Req() req: Request, @Query() dto: FiltrosEquiposDto) {
    return this.service.listar(this.actor(req), {
      sucursalId: dto.sucursalId,
      estado: dto.estado as any,
      busqueda: dto.busqueda,
      page: dto.page ?? 1,
      limit: dto.limit ?? 10,
    });
  }

  @Get(':id')
  @RequirePermission('equipo.ver')
  obtener(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: 'all' })) id: string,
  ) {
    return this.service.obtener(this.actor(req), id);
  }

  @Get(':id/history')
  @RequirePermission('equipo.ver')
  historial(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: 'all' })) id: string,
    @Query() dto: FiltrosHistorialEquipoDto,
  ) {
    return this.service.listarHistorial(this.actor(req), id, {
      page: dto.page ?? 1,
      limit: dto.limit ?? 10,
    });
  }
}
