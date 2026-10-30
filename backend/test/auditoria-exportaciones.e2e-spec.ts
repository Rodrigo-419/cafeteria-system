// Alcance de lectura de la auditoria para las exportaciones.
//
// Un evento `exportacion` no tiene usuario afectado ni sucursal afectada. La
// regla es:
//
//   * Admin: ve todas las exportaciones.
//   * Gerente: solo las suyas (actor = el mismo), nunca las de otro Gerente ni
//     las del Admin.
//   * El historial por usuario NUNCA incluye exportaciones, porque no son
//     cambios sobre una persona.
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearAppDePruebas } from './utils/crear-app-pruebas';
import {
  cerrarClientePrueba,
  clientePrueba,
  resetDatabase,
} from './utils/reset-database';
import { como, iniciarSesion } from './utils/http-pruebas';
import {
  crearEmpleado,
  crearGerente,
  idsDeSucursales,
  type Sucursales,
} from './utils/fixtures-pruebas';
import {
  ADMIN_PASSWORD_PRUEBAS,
  ADMIN_USUARIO_PRUEBAS,
} from './utils/constantes-pruebas';

type EventoAuditoria = {
  id: string;
  entidad: string;
  accion: string;
  actor: { id: string; nombre: string; nombreUsuario: string };
  usuarioAfectadoId: string | null;
  detalle: any;
  fecha: string;
};

type PaginaAuditoria = {
  eventos: EventoAuditoria[];
  total: number;
};

type Descarga = {
  status: number;
  buffer: Buffer;
};

function parserBinario(
  respuesta: any,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const partes: Buffer[] = [];
  respuesta.on('data', (parte: Buffer | string) => {
    partes.push(Buffer.isBuffer(parte) ? parte : Buffer.from(parte));
  });
  respuesta.on('end', () => callback(null, Buffer.concat(partes)));
  respuesta.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
}

describe('auditoria de exportaciones (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let adminId: string;
  let sucursales: Sucursales;

  beforeAll(async () => {
    app = await crearAppDePruebas();
  });

  beforeEach(async () => {
    await resetDatabase(clientePrueba());

    const sesion = await iniciarSesion(
      app,
      ADMIN_USUARIO_PRUEBAS,
      ADMIN_PASSWORD_PRUEBAS,
    ).expect(200);

    admin = sesion.body.accessToken as string;
    adminId = sesion.body.user.id as string;
    sucursales = await idsDeSucursales();
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  /** Exporta `usuarios` en CSV y exige 200. */
  async function exportarUsuarios(token: string): Promise<Descarga> {
    const respuesta = await request(app.getHttpServer())
      .post('/api/exports')
      .set(...como(token))
      .send({ conjunto: 'usuarios', formato: 'csv' })
      .buffer(true)
      .parse(parserBinario);

    return {
      status: respuesta.status,
      buffer: respuesta.body as Buffer,
    };
  }

  async function eventos(
    token: string,
    query: string,
  ): Promise<EventoAuditoria[]> {
    const respuesta = await request(app.getHttpServer())
      .get(`/api/auditoria?limit=100&${query}`)
      .set(...como(token))
      .expect(200);

    return (respuesta.body as PaginaAuditoria).eventos;
  }

  async function historial(
    token: string,
    usuarioId: string,
  ): Promise<PaginaAuditoria> {
    const respuesta = await request(app.getHttpServer())
      .get(`/api/auditoria/usuarios/${usuarioId}?limit=100`)
      .set(...como(token))
      .expect(200);

    return respuesta.body as PaginaAuditoria;
  }

  it('el Admin ve todas las exportaciones y cada Gerente solo las suyas', async () => {
    const gerenteCentro = await crearGerente(
      app,
      admin,
      sucursales.centro,
      'Gerente Auditoria Centro',
    );
    const gerenteNorte = await crearGerente(
      app,
      admin,
      sucursales.norte,
      'Gerente Auditoria Norte',
    );

    expect((await exportarUsuarios(admin)).status).toBe(200);
    expect((await exportarUsuarios(gerenteCentro.token)).status).toBe(200);
    expect((await exportarUsuarios(gerenteNorte.token)).status).toBe(200);

    const comoAdmin = await eventos(
      admin,
      'entidad=exportacion&accion=exportacion_generada',
    );
    expect(comoAdmin).toHaveLength(3);
    expect(comoAdmin.map((evento) => evento.actor.id).sort()).toEqual(
      [adminId, gerenteCentro.usuario.id, gerenteNorte.usuario.id].sort(),
    );

    const comoCentro = await eventos(
      gerenteCentro.token,
      'entidad=exportacion&accion=exportacion_generada',
    );
    expect(comoCentro).toHaveLength(1);
    expect(comoCentro[0]!.actor.id).toBe(gerenteCentro.usuario.id);

    const comoNorte = await eventos(
      gerenteNorte.token,
      'entidad=exportacion&accion=exportacion_generada',
    );
    expect(comoNorte).toHaveLength(1);
    expect(comoNorte[0]!.actor.id).toBe(gerenteNorte.usuario.id);

    // Ni siquiera pidiendo explicitamente el actor ajeno se rompe el alcance.
    const intento = await eventos(
      gerenteCentro.token,
      `entidad=exportacion&accion=exportacion_generada&actorId=${gerenteNorte.usuario.id}`,
    );
    expect(intento).toHaveLength(0);
  });

  it('las exportaciones nunca aparecen en el historial de ningun usuario', async () => {
    const gerenteCentro = await crearGerente(
      app,
      admin,
      sucursales.centro,
      'Gerente Historial Export',
    );
    const gerenteNorte = await crearGerente(
      app,
      admin,
      sucursales.norte,
      'Gerente Historial Norte',
    );
    const empleadoCentro = await crearEmpleado(
      app,
      admin,
      sucursales.centro,
      'Empleado Historial Export',
    );

    expect((await exportarUsuarios(gerenteCentro.token)).status).toBe(200);
    expect((await exportarUsuarios(admin)).status).toBe(200);

    const objetivos = [
      adminId,
      gerenteCentro.usuario.id,
      gerenteNorte.usuario.id,
      empleadoCentro.id,
    ];

    for (const objetivo of objetivos) {
      const pagina = await historial(admin, objetivo);

      for (const evento of pagina.eventos) {
        expect(evento.entidad).not.toBe('exportacion');
        expect(evento.accion).not.toMatch(/^exportacion_/);
      }
    }

    // El historial del Empleado si tiene eventos de persona: la consulta
    // funciona y aun asi no aparece ninguna exportacion.
    const paginaEmpleado = await historial(admin, empleadoCentro.id);
    expect(paginaEmpleado.eventos.length).toBeGreaterThan(0);

    // Un Gerente puede leer el historial de su Empleado y tampoco ve la
    // exportacion que el mismo genero.
    const comoGerente = await historial(
      gerenteCentro.token,
      empleadoCentro.id,
    );
    for (const evento of comoGerente.eventos) {
      expect(evento.entidad).not.toBe('exportacion');
    }

    // La exportacion si existe en el listado general del Gerente.
    const exportaciones = await eventos(
      gerenteCentro.token,
      'entidad=exportacion',
    );
    expect(exportaciones.length).toBeGreaterThanOrEqual(1);
  });
});
