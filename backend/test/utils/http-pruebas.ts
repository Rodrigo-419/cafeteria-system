// Atajos para las pruebas end-to-end por HTTP.
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  ADMIN_EMAIL_PRUEBAS,
  ADMIN_PASSWORD_PRUEBAS,
} from './constantes-pruebas';

export type RespuestaLogin = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: {
    id: string;
    nombre: string;
    email: string;
    rol: string | null;
    sucursalId: string | null;
    permisos: string[];
  };
};

/** Inicia sesion y devuelve la respuesta completa, con su codigo HTTP. */
export function iniciarSesion(
  app: INestApplication,
  email: string,
  password: string,
): request.Test {
  return request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
}

/** Token de acceso del administrador de pruebas. */
export async function tokenDeAdmin(app: INestApplication): Promise<string> {
  const respuesta = await iniciarSesion(
    app,
    ADMIN_EMAIL_PRUEBAS,
    ADMIN_PASSWORD_PRUEBAS,
  ).expect(200);

  return (respuesta.body as RespuestaLogin).accessToken;
}

/** Cabecera de autorizacion lista para supertest. */
export function como(token: string): ['Authorization', string] {
  return ['Authorization', `Bearer ${token}`];
}