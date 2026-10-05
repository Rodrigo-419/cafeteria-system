// Datos de partida para las pruebas de usuarios.
//
// Los ids de sucursal y de permiso se leen de la base en lugar de fijarse en el
// codigo: el seed genera UUIDs v7 nuevas en cada reset, y un id fijo en el
// codigo dejaria de ser valido en cuanto cambiara el seed.
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { clientePrueba } from './reset-database';
import { como, iniciarSesion } from './http-pruebas';
import { PASSWORD_VALIDA_PRUEBAS } from './constantes-pruebas';

export type Sucursales = {
  centro: string;
  norte: string;
  sur: string;
};

/** Ids de las tres sucursales que crea el seed, por nombre. */
export async function idsDeSucursales(): Promise<Sucursales> {
  const prisma = clientePrueba();
  const filas = await prisma.sucursal.findMany({
    where: { nombre: { in: ['Sucursal Centro', 'Sucursal Norte', 'Sucursal Sur'] } },
    select: { id: true, nombre: true },
  });

  const porNombre = new Map(filas.map((f) => [f.nombre, f.id]));
  const obtner = (nombre: string): string => {
    const id = porNombre.get(nombre);
    if (!id) {
      throw new Error(`El seed no creo la sucursal "${nombre}"`);
    }
    return id;
  };

  return {
    centro: obtner('Sucursal Centro'),
    norte: obtner('Sucursal Norte'),
    sur: obtner('Sucursal Sur'),
  };
}

/** Id de un permiso por su codigo. */
export async function idDePermiso(codigo: string): Promise<string> {
  const permiso = await clientePrueba().permiso.findUnique({
    where: { codigo },
    select: { id: true },
  });

  if (!permiso) {
    throw new Error(`El seed no creo el permiso "${codigo}"`);
  }

  return permiso.id;
}

export type UsuarioCreado = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  sucursalId: string | null;
  estado: string;
};

export type DatosCrearUsuario = {
  nombre: string;
  email: string;
  rol: 'Admin' | 'Gerente' | 'Empleado';
  sucursalId?: string | null;
  password?: string;
};

/** Crea un usuario por HTTP y devuelve el cuerpo de la respuesta. */
export async function crearUsuarioPorHttp(
  app: INestApplication,
  token: string,
  datos: DatosCrearUsuario,
): Promise<UsuarioCreado> {
  const respuesta = await request(app.getHttpServer())
    .post('/api/users')
    .set(...como(token))
    .send({
      nombre: datos.nombre,
      email: datos.email,
      password: datos.password ?? PASSWORD_VALIDA_PRUEBAS,
      rol: datos.rol,
      ...(datos.sucursalId !== undefined ? { sucursalId: datos.sucursalId } : {}),
    })
    .expect(201);

  return respuesta.body as UsuarioCreado;
}

/** Crea un Gerente y su token. */
export async function crearGerente(
  app: INestApplication,
  tokenAdmin: string,
  sucursalId: string,
  nombre: string,
): Promise<{ usuario: UsuarioCreado; token: string }> {
  const email = `${nombre.toLowerCase().replace(/\s+/gu, '.')}@cafeteria.test`;

  const usuario = await crearUsuarioPorHttp(app, tokenAdmin, {
    nombre,
    email,
    rol: 'Gerente',
    sucursalId,
  });

  const token = (
    await iniciarSesion(app, email, PASSWORD_VALIDA_PRUEBAS).expect(200)
  ).body.accessToken as string;

  return { usuario, token };
}

/** Crea un Empleado y devuelve su id. */
export async function crearEmpleado(
  app: INestApplication,
  tokenAdmin: string,
  sucursalId: string,
  nombre: string,
): Promise<UsuarioCreado> {
  return crearUsuarioPorHttp(app, tokenAdmin, {
    nombre,
    email: `${nombre.toLowerCase().replace(/\s+/gu, '.')}@cafeteria.test`,
    rol: 'Empleado',
    sucursalId,
  });
}