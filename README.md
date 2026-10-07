# Cafeteria System

Sistema de gestión para una cadena de cafeterías con múltiples sucursales.
Permite centralizar ventas, inventario, personal y asistencia de cada sede.
Monorepo con backend NestJS, frontend y documentación técnica.

## Documentación

- [Decisiones de diseño](docs/architecture/decisiones-de-diseno.md)

## Pruebas

### Unitarias

Prueban lógica aislada: casos de uso y reglas de dominio, sin base de datos.

```bash
cd backend
npm test
```

### E2E

Levantan la aplicación Nest real contra una base de datos **aparte** y la ejercitan por HTTP con Supertest. Reutilizan el mismo `configureApp` que `main.ts`, de modo que el prefijo global y el `ValidationPipe` se prueban tal y como están en producción.

```bash
cd backend
npm run test:e2e
```

La configuración vive en `backend/test/jest-e2e.json` y:

- corre en serie (`--runInBand`) porque las pruebas comparten una única base de datos;
- fija `DATABASE_URL` y el secreto JWT en `test/entorno-pruebas.ts` como `setupFiles`, antes de que se importe `AppModule`, porque `ConfigModule.forRoot()` lee el entorno en el momento de la importación;
- redirige los imports del cliente Prisma generado a su `.ts`, ya que Node no resuelve el `.js` que aparece en el código generado.

#### Base de datos de pruebas

Las pruebas nunca tocan la base de desarrollo. El nombre se deriva de `DATABASE_URL` y debe terminar en `_test`; si no, la ejecución se aborta antes de migrar o borrar nada.

```bash
docker exec cafeteria-db psql -U postgres -c 'CREATE DATABASE cafeteria_test;'
```

Ese es el único paso manual: la URL completa se calcula a partir de `backend/.env` sin imprimirla, `prisma migrate deploy` aplica las migraciones y cada prueba empieza truncando las tablas y volviendo a sembrar los datos mínimos (3 sucursales, 3 roles, permisos y un administrador).

El resto del entorno de pruebas (secreto JWT, credenciales del administrador y puertos) está en `backend/test/utils/constantes-pruebas.ts`.