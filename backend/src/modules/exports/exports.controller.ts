import { Controller, Post, Body, Res, Req } from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ExportsService } from './exports.service';

@Controller('exports')
export class ExportsController {
  constructor(private exportsService: ExportsService) {}

  @Post()
  @RequirePermission('usuarios.crear_editar')
  async exportSingle(@Res() res: Response, @Req() req: any, @Body() body: any) {
    return this.exportsService.exportSingle(res, req.user, body);
  }

  @Post('full')
  @RequirePermission('usuarios.crear_editar')
  async exportFull(@Res() res: Response, @Req() req: any) {
    return this.exportsService.exportFull(res, req.user);
  }
}
