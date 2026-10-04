import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { APP_GLOBAL_PREFIX } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix(configService.get<string>('app.globalPrefix', APP_GLOBAL_PREFIX));
  // Necesario para que se ejecute onModuleDestroy y PrismaService cierre
  // el pool de conexiones al recibir SIGINT/SIGTERM.
  app.enableShutdownHooks();

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
}
void bootstrap();