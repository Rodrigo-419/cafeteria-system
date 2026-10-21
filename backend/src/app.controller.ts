import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
@ApiTags('salud')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Ruta de comprobacion general' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Comprobacion de salud del servicio' })
  health(): { estado: string } {
    return this.appService.health();
  }
}
