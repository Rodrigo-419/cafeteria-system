// Pruebas del cableado del reintento de conexion en el repositorio de
// autenticacion: las dos lecturas que abren una peticion (login y refresco de
// sesion) deben reintentar si la base estaba suspendida, pero no ante otro tipo
// de error.
import { AuthRepository } from './auth.repository';
import type { PrismaService } from '../../../database/prisma.service';

function repositorioCon(
  findUnique: jest.Mock,
): { repositorio: AuthRepository; findUnique: jest.Mock } {
  const prisma = { usuario: { findUnique } } as unknown as PrismaService;
  return { repositorio: new AuthRepository(prisma), findUnique };
}

function errorDeConexion() {
  const error = new Error('Connection terminated unexpectedly');
  (error as Error & { code?: string }).code = 'P1017';
  return error;
}

function errorDeNegocio() {
  const error = new Error('write conflict');
  (error as Error & { code?: string }).code = 'P2034';
  return error;
}

describe('AuthRepository: reintento de conexion', () => {
  it('buscarUsuarioPorNombreUsuario reintenta una lectura y devuelve el valor', async () => {
    const { repositorio, findUnique } = repositorioCon(
      jest
        .fn()
        .mockRejectedValueOnce(errorDeConexion())
        .mockResolvedValueOnce({ id: 'usuario-1' }),
    );

    await expect(
      repositorio.buscarUsuarioPorNombreUsuario('ada'),
    ).resolves.toEqual({ id: 'usuario-1' });
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('buscarUsuarioPorId tambien reintenta la lectura', async () => {
    const { repositorio, findUnique } = repositorioCon(
      jest
        .fn()
        .mockRejectedValueOnce(errorDeConexion())
        .mockResolvedValueOnce({ id: 'usuario-1' }),
    );

    await expect(repositorio.buscarUsuarioPorId('usuario-1')).resolves.toEqual({
      id: 'usuario-1',
    });
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('no reintenta cuando el error no es de conexion', async () => {
    const { repositorio, findUnique } = repositorioCon(
      jest.fn().mockRejectedValue(errorDeNegocio()),
    );

    await expect(
      repositorio.buscarUsuarioPorNombreUsuario('ada'),
    ).rejects.toMatchObject({ code: 'P2034' });
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('propaga el error cuando se agotan los reintentos', async () => {
    const { repositorio, findUnique } = repositorioCon(
      jest.fn().mockRejectedValue(errorDeConexion()),
    );

    await expect(
      repositorio.buscarUsuarioPorNombreUsuario('ada'),
    ).rejects.toMatchObject({ code: 'P1017' });
    expect(findUnique).toHaveBeenCalledTimes(3);
  });
});
