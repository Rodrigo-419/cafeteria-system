import { Module } from '@nestjs/common';
import { UsersController } from './presentation/users.controller';
import { UsersRepository } from './infrastructure/users.repository';
import { ActualizarUsuarioUseCase } from './application/use-cases/actualizar-usuario.use-case';
import { AsignarPermisoUseCase } from './application/use-cases/asignar-permiso.use-case';
import { CambiarEstadoUseCase } from './application/use-cases/cambiar-estado.use-case';
import { CambiarPropiaPasswordUseCase } from './application/use-cases/cambiar-propia-password.use-case';
import { CrearUsuarioUseCase } from './application/use-cases/crear-usuario.use-case';
import { EliminarPermisoUseCase } from './application/use-cases/eliminar-permiso.use-case';
import { ListarPermisosUsuarioUseCase } from './application/use-cases/listar-permisos-usuario.use-case';
import { ListarUsuariosUseCase } from './application/use-cases/listar-usuarios.use-case';
import { ObtenerUsuarioUseCase } from './application/use-cases/obtener-usuario.use-case';
import { RestablecerPasswordUseCase } from './application/use-cases/restablecer-password.use-case';

@Module({
  controllers: [UsersController],
  providers: [
    UsersRepository,
    CrearUsuarioUseCase,
    ListarUsuariosUseCase,
    ObtenerUsuarioUseCase,
    ActualizarUsuarioUseCase,
    CambiarEstadoUseCase,
    RestablecerPasswordUseCase,
    CambiarPropiaPasswordUseCase,
    ListarPermisosUsuarioUseCase,
    AsignarPermisoUseCase,
    EliminarPermisoUseCase,
  ],
  exports: [UsersRepository],
})
export class UsersModule {}