import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { debeHabilitarDocumentacion } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Prefijo global y ValidationPipe viven en `configureApp`, el mismo sitio que
  // usan las pruebas end-to-end, para no duplicar la configuracion.
  configureApp(app, {
    trustProxy: configService.get<string>('TRUST_PROXY'),
    corsOrigin: configService.get<string>('CORS_ORIGIN'),
  });

  // Necesario para que se ejecute onModuleDestroy y PrismaService cierre
  // el pool de conexiones al recibir SIGINT/SIGTERM.
  app.enableShutdownHooks();

  // Swagger solo fuera de produccion: en produccion no se publica.
  if (debeHabilitarDocumentacion(configService.get<string>('NODE_ENV'))) {
    const config = new DocumentBuilder()
      .setTitle('Cafeteria System API')
      .setDescription('API de gestion de cafeteria')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port, '0.0.0.0');
}
void bootstrap();