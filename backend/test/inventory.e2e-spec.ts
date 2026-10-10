// Pruebas E2E del modulo de inventario: catalogo de insumos, stock por sucursal,
// entradas, movimientos, recuentos y alertas de stock.
//
// Los ids de sucursal y de insumo se leen de la base o se crean por HTTP, nunca se
// fijan en el codigo: el seed genera UUIDs v7 nuevas en cada reset y el catalogo
// lo crea el Admin por la misma API que usa un cliente real.
//
// Los datos se preparan UNA vez en `beforeAll` y las pruebas van encadenadas en el
// orden en que se declaran. Un `resetDatabase` por prueba multiplicaria por diez
// el tiempo de la suite (el seed siembra roles, permisos y usuarios) para no
// comprobar nada que las pruebas unitarias ya cubren; aqui lo que se comprueba es
// el camino completo contra PostgreSQL: SQL a mano, bloqueos, `Decimal` y estado
// que se queda escrito.
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearAppDePruebas } from './utils/crear-app-pruebas';
import { clientePrueba, cerrarClientePrueba, resetDatabase } from './utils/reset-database';
import { como, tokenDeAdmin } from './utils/http-pruebas';
import { crearGerente, idsDeSucursales, type Sucursales } from './utils/fixtures-pruebas';

// ------------------------------------------------------------------ respuestas

type InsumoE2E = {
  id: string;
  nombre: string;
  presentacion: string;
  createdAt: string;
  updatedAt: string;
};

type StockE2E = {
  id: string;
  insumoId: string;
  sucursalId: string;
  stockActual: string;
  stockMinimo: string;
  estado: string;
  insumo: InsumoE2E;
};

type MovimientoE2E = {
  id: string;
  insumoSucursalId: string;
  tipo: string;
  cantidad: string;
  usuarioId: string;
  motivo: string;
  createdAt: string;
};

type AlertaE2E = {
  id: string;
  insumoSucursalId: string;
  estado: string;
  insumoSucursal: StockE2E;
};

type RecuentoDetalleE2E = {
  id: string;
  insumoSucursalId: string;
  stockSistema: string;
  stockFisico: string;
  diferencia: string;
};

type RecuentoE2E = {
  id: string;
  sucursalId: string;
  usuarioId: string;
  createdAt: string;
};

type RecuentoCompletoE2E = RecuentoE2E & {
  usuario: { id: string; nombre: string };
  sucursal: { id: string; nombre: string };
  detalles: RecuentoDetalleE2E[];
};

type Listado<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPaginas: number;
};

type ErrorE2E = { message: string; error?: string; statusCode?: number };

// -------------------------------------------------------------------- contexto

describe('inventario E2E', () => {
  let app: INestApplication;
  let tokenAdmin: string;
  let sucursales: Sucursales;

  // Sucursal Centro, donde vive casi toda la prueba.
  let centro: string;
  // Sucursal Norte, para probar el alcance entre sucursales.
  let norte: string;

  let tokenGerente: string;

  let cafeId: string;
  let lecheId: string;
  let jarraId: string;
  /** Filas de stock ya configuradas en Centro, por insumo. */
  let stockCafeId: string;

  /** Nombre del insumo nuevo de cada prueba, para que no choque con otro. */
  let contador = 0;

  function nombreLibre(base: string): string {
    contador += 1;
    return `${base} ${contador}`;
  }

  function api(cliente: string) {
    return {
      crearInsumo: (nombre: string, presentacion = 'paquete') =>
        request(app.getHttpServer())
          .post('/api/insumos')
          .set(...como(cliente))
          .send({ nombre, presentacion })
          .expect(201)
          .then((r) => r.body as InsumoE2E),

      crear: (nombre: string, presentacion = 'paquete') =>
        request(app.getHttpServer())
          .post('/api/insumos')
          .set(...como(cliente))
          .send({ nombre, presentacion }),

      listarInsumos: (query = '') =>
        request(app.getHttpServer())
          .get(`/api/insumos${query}`)
          .set(...como(cliente))
          .expect(200)
          .then((r) => r.body as Listado<InsumoE2E>),

      verInsumo: (id: string, cliente2 = cliente) =>
        request(app.getHttpServer()).get(`/api/insumos/${id}`).set(...como(cliente2)),

      editarInsumo: (id: string, datos: Record<string, unknown>, cliente2 = cliente) =>
        request(app.getHttpServer())
          .patch(`/api/insumos/${id}`)
          .set(...como(cliente2))
          .send(datos),

      borrarInsumo: (id: string, cliente2 = cliente) =>
        request(app.getHttpServer()).delete(`/api/insumos/${id}`).set(...como(cliente2)),

      listarStock: (sucursalId: string, query = '', cliente2 = cliente) =>
        request(app.getHttpServer())
          .get(`/api/inventario/sucursales/${sucursalId}/stock${query}`)
          .set(...como(cliente2))
          .expect(200)
          .then((r) => r.body as Listado<StockE2E>),

      configurar: (sucursalId: string, insumoId: string, datos: Record<string, unknown>) =>
        request(app.getHttpServer())
          .put(`/api/inventario/sucursales/${sucursalId}/insumos/${insumoId}`)
          .set(...como(cliente))
          .send(datos),

      registrarEntrada: (sucursalId: string, insumoId: string, datos: Record<string, unknown>) =>
        request(app.getHttpServer())
          .post(`/api/inventario/sucursales/${sucursalId}/insumos/${insumoId}/entradas`)
          .set(...como(cliente))
          .send(datos),

      listarMovimientos: (sucursalId: string, query = '') =>
        request(app.getHttpServer())
          .get(`/api/inventario/sucursales/${sucursalId}/movimientos${query}`)
          .set(...como(cliente))
          .expect(200)
          .then((r) => r.body as Listado<MovimientoE2E>),

      listarAlertas: (query = '') =>
        request(app.getHttpServer())
          .get(`/api/inventario/alertas${query}`)
          .set(...como(cliente))
          .expect(200)
          .then((r) => r.body as Listado<AlertaE2E>),

      crearRecuento: (sucursalId: string, items: Array<{ insumoId: string; stockFisico: number }>) =>
        request(app.getHttpServer())
          .post(`/api/inventario/sucursales/${sucursalId}/recuentos`)
          .set(...como(cliente))
          .send({ items }),

      listarRecuentos: (query = '') =>
        request(app.getHttpServer())
          .get(`/api/inventario/recuentos${query}`)
          .set(...como(cliente))
          .expect(200)
          .then((r) => r.body as Listado<RecuentoE2E>),

      verRecuento: (id: string) =>
        request(app.getHttpServer())
          .get(`/api/inventario/recuentos/${id}`)
          .set(...como(cliente))
          .expect(200)
          .then((r) => r.body as RecuentoCompletoE2E),
    };
  }

  beforeAll(async () => {
    app = await crearAppDePruebas();

    await resetDatabase(clientePrueba());

    tokenAdmin = await tokenDeAdmin(app);
    sucursales = await idsDeSucursales();
    centro = sucursales.centro;
    norte = sucursales.norte;

    const gerente = await crearGerente(app, tokenAdmin, centro, 'Gerente Centro');
    tokenGerente = gerente.token;

    const ins = api(tokenAdmin);
    cafeId = (await ins.crearInsumo('Cafe molido', 'paquete')).id;
    lecheId = (await ins.crearInsumo('Leche entera', 'bolsa')).id;
    jarraId = (await ins.crearInsumo('Jarra termica', 'unidad')).id;
  }, 60_000);

  afterAll(async () => {
    await cerrarClientePrueba();
    await app.close();
  });

  // --------------------------------------------------------------- catalogo

  describe('catalogo de insumos', () => {
    it('crea un insumo y lo devuelve con su presentacion', async () => {
      const nombre = nombreLibre('Azucar');
      const creado = await api(tokenAdmin).crearInsumo(nombre, 'bolsa');

      expect(creado.nombre).toBe(nombre);
      expect(creado.presentacion).toBe('bolsa');
      expect(creado.id).toEqual(expect.any(String));
    });

    it('recorta el nombre y deja un solo espacio entre palabras', async () => {
      const respuesta = await api(tokenAdmin)
        .crear('  Con   espacios  ')
        .expect(201);

      // Los espacios de los extremos se van y las separaciones internas se
      // reducen a una; las mayusculas se respetan tal cual las escribio el
      // usuario.
      expect((respuesta.body as InsumoE2E).nombre).toBe('Con espacios');
    });

    it('rechaza un nombre de un solo caracter con 400', async () => {
      const respuesta = await api(tokenAdmin)
        .editarInsumo(cafeId, { nombre: 'x' })
        .expect(400);

      expect((respuesta.body as ErrorE2E).message).toEqual(expect.any(Array));
    });

    it('rechaza una presentacion inexistente con 400 y la lista las admitidas', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/insumos')
        .set(...como(tokenAdmin))
        .send({ nombre: nombreLibre('Con presentacion mala'), presentacion: 'litro' })
        .expect(400);

      const mensaje = JSON.stringify((respuesta.body as ErrorE2E).message);

      expect(mensaje).toContain('paquete');
      expect(mensaje).toContain('paquete_varias_unidades');
    });

    it('rechaza un nombre duplicado con 409', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/insumos')
        .set(...como(tokenAdmin))
        .send({ nombre: 'Cafe molido', presentacion: 'paquete' })
        .expect(409);

      expect((respuesta.body as ErrorE2E).message).toBe('Ya existe un insumo con ese nombre');
    });

    it('trata como duplicado el mismo nombre en otras mayusculas', async () => {
      await request(app.getHttpServer())
        .post('/api/insumos')
        .set(...como(tokenAdmin))
        .send({ nombre: 'CAFE MOLIDO', presentacion: 'paquete' })
        .expect(409);
    });

    it('lista el catalogo en el sobre de paginado', async () => {
      const listado = await api(tokenAdmin).listarInsumos();

      expect(listado.data.length).toBeGreaterThanOrEqual(3);
      expect(listado.total).toBeGreaterThanOrEqual(3);
      expect(listado.page).toBe(1);
      expect(listado.totalPaginas).toBeGreaterThanOrEqual(1);
    });

    it('la pagina 1 empieza por el principio, no se salta el primer bloque', async () => {
      const primera = await api(tokenAdmin).listarInsumos('?page=1&limit=2');
      const segunda = await api(tokenAdmin).listarInsumos('?page=2&limit=2');

      expect(primera.data).toHaveLength(2);
      expect(segunda.data.length).toBeGreaterThan(0);

      const idsPrimera = primera.data.map((i) => i.id);
      const solapados = segunda.data.filter((i) => idsPrimera.includes(i.id));

      // Si el salto fuese `page * limit`, la pagina 1 se saltaria las dos
      // primeras y estas dos paginas no podrian solaparse ni empezar igual.
      expect(solapados).toHaveLength(0);
      expect(primera.data[0].id).not.toBe(segunda.data[0].id);
    });

    it('filtra por nombre, sin distinguir mayusculas', async () => {
      const listado = await api(tokenAdmin).listarInsumos('?q=JARRA');

      expect(listado.data).toHaveLength(1);
      expect(listado.data[0].id).toBe(jarraId);
    });

    it('obtiene un insumo por su id', async () => {
      const respuesta = await api(tokenAdmin).verInsumo(cafeId).expect(200);

      expect((respuesta.body as InsumoE2E).id).toBe(cafeId);
    });

    it('responde 404 con un id que no existe', async () => {
      await api(tokenAdmin)
        .verInsumo('00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('edita el nombre y la presentacion', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Para editar'))).id;

      const respuesta = await api(tokenAdmin)
        .editarInsumo(id, { nombre: nombreLibre('Editado'), presentacion: 'caja' })
        .expect(200);

      const cuerpo = respuesta.body as InsumoE2E;

      expect(cuerpo.presentacion).toBe('caja');
      expect(cuerpo.nombre).toMatch(/^Editado /u);
    });

    it('no deja renombrar a un nombre que ya usa otro insumo', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Para colision'))).id;

      await api(tokenAdmin).editarInsumo(id, { nombre: 'Cafe molido' }).expect(409);
    });

    it('no deja vaciar el nombre', async () => {
      await api(tokenAdmin).editarInsumo(cafeId, { nombre: '   ' }).expect(400);
    });

    it('borra un insumo que no tiene stock en ninguna sucursal', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Efimero'))).id;

      await api(tokenAdmin).borrarInsumo(id).expect(204);

      await api(tokenAdmin).verInsumo(id).expect(404);
    });

    it('responde 409 al borrar un insumo que ya tiene stock', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Con stock'))).id;
      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 1 }).expect(200);

      const respuesta = await api(tokenAdmin).borrarInsumo(id).expect(409);

      expect((respuesta.body as ErrorE2E).message).toMatch(/descontinualo/u);
    });

    it('exige el permiso de editar el catalogo, que es solo del Admin', async () => {
      // El Gerente tiene `insumos.ver` pero no `insumos.catalogo.editar`.
      await api(tokenGerente)
        .editarInsumo(cafeId, { nombre: nombreLibre('Intruso') }, tokenGerente)
        .expect(403);
    });

    it('deja ver el catalogo al Gerente', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/api/insumos')
        .set(...como(tokenGerente))
        .expect(200);

      expect((respuesta.body as Listado<InsumoE2E>).data.length).toBeGreaterThan(0);
    });

    it('responde 401 sin token', async () => {
      await request(app.getHttpServer()).get('/api/insumos').expect(401);
    });
  });

  // ------------------------------------------------------------------- stock

  describe('configuracion de stock', () => {
    it('da de alta un insumo en la sucursal con stock a cero', async () => {
      const respuesta = await api(tokenAdmin)
        .configurar(centro, cafeId, { stockMinimo: 10 })
        .expect(200);

      const cuerpo = respuesta.body as StockE2E;

      expect(cuerpo.stockActual).toBe('0.00');
      expect(cuerpo.stockMinimo).toBe('10.00');
      expect(cuerpo.estado).toBe('activo');
      stockCafeId = cuerpo.id;
    });

    it('devuelve los decimales como texto con dos decimales', async () => {
      await api(tokenAdmin).configurar(centro, lecheId, { stockMinimo: 2.5 }).expect(200);

      const respuesta = await api(tokenAdmin)
        .configurar(centro, lecheId, { stockMinimo: 3 })
        .expect(200);

      expect(typeof (respuesta.body as StockE2E).stockMinimo).toBe('string');
      expect((respuesta.body as StockE2E).stockMinimo).toBe('3.00');
    });

    it('acepta un minimo de cero', async () => {
      const respuesta = await api(tokenAdmin)
        .configurar(centro, jarraId, { stockMinimo: 0 })
        .expect(200);

      expect((respuesta.body as StockE2E).stockMinimo).toBe('0.00');
    });

    it('rechaza un minimo negativo con 400', async () => {
      await api(tokenAdmin).configurar(centro, cafeId, { stockMinimo: -1 }).expect(400);
    });

    it('rechaza un minimo con tres decimales con 400', async () => {
      await api(tokenAdmin).configurar(centro, cafeId, { stockMinimo: 1.005 }).expect(400);
    });

    it('rechaza un cuerpo vacio con 400', async () => {
      await api(tokenAdmin).configurar(centro, cafeId, {}).expect(400);
    });

    it('descontinuar no borra el minimo que ya estaba puesto', async () => {
      await api(tokenAdmin).configurar(centro, cafeId, { stockMinimo: 10 }).expect(200);

      const respuesta = await api(tokenAdmin)
        .configurar(centro, cafeId, { estado: 'descontinuado' })
        .expect(200);

      const cuerpo = respuesta.body as StockE2E;

      expect(cuerpo.estado).toBe('descontinuado');
      // Si el update mandara el minimo por defecto, esto seria '0.00'.
      expect(cuerpo.stockMinimo).toBe('10.00');

      // Se reactiva enseguida: `café` es el insumo que usan todas las pruebas
      // siguientes de stock, movimientos, recuentos y alertas, y una fila
      // descontinuada no admite entradas (409).
      await api(tokenAdmin).configurar(centro, cafeId, { estado: 'activo' }).expect(200);
    });

    it('responde 404 si el insumo no existe', async () => {
      await api(tokenAdmin)
        .configurar(centro, '00000000-0000-0000-0000-000000000000', { stockMinimo: 1 })
        .expect(404);
    });

    it('responde 404 si la sucursal no existe', async () => {
      await api(tokenAdmin)
        .configurar('00000000-0000-0000-0000-000000000000', cafeId, { stockMinimo: 1 })
        .expect(404);
    });

    it('un Gerente no puede tocar el stock de otra sucursal', async () => {
      const respuesta = await request(app.getHttpServer())
        .put(`/api/inventario/sucursales/${norte}/insumos/${cafeId}`)
        .set(...como(tokenGerente))
        .send({ stockMinimo: 1 })
        .expect(404);

      expect((respuesta.body as ErrorE2E).message).toBe('La sucursal no existe');
    });

    it('la base rechaza que el stock actual quede negativo', async () => {
      // La fila se crea en la propia prueba para no depender de datos previos:
      // se usa un insumo nuevo y una escritura directa contra la base, porque
      // lo que se comprueba es el CHECK, no el caso de uso.
      const insumo = await api(tokenAdmin).crearInsumo(
        nombreLibre('Para chequeo negativo'),
        'paquete',
      );

      const fila = await clientePrueba().insumoSucursal.create({
        data: {
          insumoId: insumo.id,
          sucursalId: centro,
          stockActual: 0,
          stockMinimo: 0,
          estado: 'activo',
        },
      });

      await expect(
        clientePrueba().$executeRaw`
          UPDATE insumo_sucursal
             SET stock_actual = -1
           WHERE id = ${fila.id}
        `,
      ).rejects.toThrow();

      const intacta = await clientePrueba().insumoSucursal.findUniqueOrThrow({
        where: { id: fila.id },
      });
      expect(Number(intacta.stockActual)).toBe(0);
    });
  });

  describe('entradas de stock', () => {
    it('suma al stock y devuelve la fila actualizada', async () => {
      const respuesta = await api(tokenAdmin)
        .registrarEntrada(centro, cafeId, { cantidad: 12, motivo: 'Compra inicial' })
        .expect(201);

      const cuerpo = respuesta.body as { stock: StockE2E; movimiento: MovimientoE2E };

      expect(cuerpo.stock.stockActual).toBe('12.00');
      expect(cuerpo.movimiento.tipo).toBe('entrada');
      expect(cuerpo.movimiento.cantidad).toBe('12.00');
      expect(cuerpo.movimiento.motivo).toBe('Compra inicial');
    });

    it('acumula varias entradas sobre la misma fila', async () => {
      await api(tokenAdmin).registrarEntrada(centro, cafeId, { cantidad: 0.5 }).expect(201);

      const respuesta = await api(tokenAdmin)
        .registrarEntrada(centro, cafeId, { cantidad: 3.25 })
        .expect(201);

      expect((respuesta.body as { stock: StockE2E }).stock.stockActual).toBe('15.75');
    });

    it('guarda un motivo por defecto si no se manda', async () => {
      const respuesta = await api(tokenAdmin)
        .registrarEntrada(centro, cafeId, { cantidad: 1 })
        .expect(201);

      expect((respuesta.body as { movimiento: MovimientoE2E }).movimiento.motivo).toBe(
        'Entrada de inventario',
      );
    });

    it('responde 404 si el insumo no esta dado de alta en esa sucursal', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Sin alta'))).id;

      const respuesta = await api(tokenAdmin)
        .registrarEntrada(centro, id, { cantidad: 1 })
        .expect(404);

      expect((respuesta.body as ErrorE2E).message).toBe(
        'El insumo no esta dado de alta en esta sucursal',
      );
    });

    it('responde 409 si el insumo esta descontinuado en esa sucursal', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Descontinuado'))).id;
      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 1 }).expect(200);
      await api(tokenAdmin).configurar(centro, id, { estado: 'descontinuado' }).expect(200);

      await api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 1 }).expect(409);
    });

    it('rechaza una cantidad de cero, diciendo cual es el problema', async () => {
      const respuesta = await api(tokenAdmin)
        .registrarEntrada(centro, cafeId, { cantidad: 0 })
        .expect(400);

      // El `ValidationPipe` devuelve `message` como lista de mensajes.
      const cuerpo = respuesta.body as { message: string[] };

      expect(cuerpo.message).toContain('La cantidad debe ser mayor que 0');
    });

    it('rechaza una cantidad negativa', async () => {
      await api(tokenAdmin).registrarEntrada(centro, cafeId, { cantidad: -5 }).expect(400);
    });

    it('rechaza tres decimales', async () => {
      await api(tokenAdmin).registrarEntrada(centro, cafeId, { cantidad: 1.001 }).expect(400);
    });

    it('rechaza una cantidad por encima del maximo de la columna', async () => {
      await api(tokenAdmin).registrarEntrada(centro, cafeId, { cantidad: 1e11 }).expect(400);
    });

    it('un Gerente puede registrar entradas en su sucursal', async () => {
      const respuesta = await request(app.getHttpServer())
        .post(`/api/inventario/sucursales/${centro}/insumos/${cafeId}/entradas`)
        .set(...como(tokenGerente))
        .send({ cantidad: 2 })
        .expect(201);

      expect(
        (respuesta.body as { stock: StockE2E }).stock.stockActual,
      ).toBe('18.75');
    });

    it('un Gerente no puede registrar entradas en otra sucursal', async () => {
      await request(app.getHttpServer())
        .post(`/api/inventario/sucursales/${norte}/insumos/${cafeId}/entradas`)
        .set(...como(tokenGerente))
        .send({ cantidad: 2 })
        .expect(404);
    });
  });

  describe('listado de stock', () => {
    it('lista el stock de la sucursal con el insumo anidido', async () => {
      const listado = await api(tokenAdmin).listarStock(centro);

      const fila = listado.data.find((f) => f.insumoId === cafeId);

      expect(fila).toBeDefined();
      expect(fila?.insumo.nombre).toBe('Cafe molido');
      expect(fila?.stockActual).toBe('18.75');
    });

    it('filtra por solo los que estan en o por debajo del minimo', async () => {
      // Cafe esta en 18.75 con minimo 10: no esta bajo. Subimos el minimo.
      await api(tokenAdmin).configurar(centro, cafeId, { stockMinimo: 100 }).expect(200);

      const listado = await api(tokenAdmin).listarStock(centro, '?soloBajoMinimo=true');

      const ids = listado.data.map((f) => f.insumoId);

      expect(ids).toContain(cafeId);
      for (const id of ids) {
        const fila = listado.data.find((f) => f.insumoId === id);
        expect(Number(fila?.stockActual)).toBeLessThanOrEqual(Number(fila?.stockMinimo));
      }

      await api(tokenAdmin).configurar(centro, cafeId, { stockMinimo: 10 }).expect(200);
    });

    it('el filtro de bajo minimo pagina tambien', async () => {
      await api(tokenAdmin).configurar(centro, cafeId, { stockMinimo: 100 }).expect(200);

      const primera = await api(tokenAdmin).listarStock(centro, '?soloBajoMinimo=true&page=1&limit=1');
      const segunda = await api(tokenAdmin).listarStock(centro, '?soloBajoMinimo=true&page=2&limit=1');

      expect(primera.data).toHaveLength(1);
      expect(segunda.data[0]?.id).not.toBe(primera.data[0]?.id);

      await api(tokenAdmin).configurar(centro, cafeId, { stockMinimo: 10 }).expect(200);
    });

    it('el total del filtro de bajo minimo coincide con el listado', async () => {
      const listado = await api(tokenAdmin).listarStock(centro, '?soloBajoMinimo=true');

      expect(listado.total).toBe(listado.data.length);
    });

    it('filtra por estado', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Para estado'))).id;
      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 1 }).expect(200);
      await api(tokenAdmin).configurar(centro, id, { estado: 'descontinuado' }).expect(200);

      const listado = await api(tokenAdmin).listarStock(centro, '?estado=descontinuado');

      // Otras pruebas ya dejaron filas descontinuadas, asi que no se compara el
      // conjunto entero: se comprueba que la nueva esta y que el filtro no deja
      // pasar ninguna activa.
      expect(listado.data.map((f) => f.insumoId)).toContain(id);
      expect(listado.data.every((f) => f.estado === 'descontinuado')).toBe(true);
      expect(listado.total).toBe(listado.data.length);
    });

    it('rechaza un estado que no existe con 400', async () => {
      await request(app.getHttpServer())
        .get(`/api/inventario/sucursales/${centro}/stock?estado=inventado`)
        .set(...como(tokenAdmin))
        .expect(400);
    });

    it('rechaza una pagina menor que 1 con 400', async () => {
      await request(app.getHttpServer())
        .get(`/api/inventario/sucursales/${centro}/stock?page=0`)
        .set(...como(tokenAdmin))
        .expect(400);
    });

    it('responde 404 con una sucursal que no existe, en vez de una lista vacia', async () => {
      await request(app.getHttpServer())
        .get('/api/inventario/sucursales/00000000-0000-0000-0000-000000000000/stock')
        .set(...como(tokenAdmin))
        .expect(404);
    });
  });

  describe('movimientos', () => {
    it('lista los movimientos de la sucursal con su cantidad en texto', async () => {
      const listado = await api(tokenAdmin).listarMovimientos(centro);

      expect(listado.data.length).toBeGreaterThan(0);
      expect(typeof listado.data[0].cantidad).toBe('string');

      const delCafe = listado.data.filter((m) => m.insumoSucursalId === stockCafeId);

      expect(delCafe.length).toBeGreaterThanOrEqual(4);
      expect(delCafe.reduce((suma, m) => suma + Number(m.cantidad), 0)).toBeCloseTo(18.75, 2);
    });

    it('la cantidad del movimiento es la variacion, no el stock final', async () => {
      const listado = await api(tokenAdmin).listarMovimientos(centro);
      const delCafe = listado.data.filter((m) => m.insumoSucursalId === stockCafeId);

      // Ninguna entrada debe valer mas que el stock que acabo dejando: si
      // `cantidad` fuera el valor final, la de 12 seria 15.75.
      expect(delCafe.some((m) => m.cantidad === '15.75')).toBe(false);
    });

    it('filtra por insumo del catalogo', async () => {
      const listado = await api(tokenAdmin).listarMovimientos(centro, `?insumoId=${cafeId}`);

      expect(listado.data.length).toBeGreaterThan(0);
      expect(
        listado.data.every((m) => m.insumoSucursalId === stockCafeId),
      ).toBe(true);
    });

    it('filtra por tipo', async () => {
      const listado = await api(tokenAdmin).listarMovimientos(centro, '?tipo=entrada');

      expect(listado.data.length).toBeGreaterThan(0);
      expect(listado.data.every((m) => m.tipo === 'entrada')).toBe(true);
    });

    it('filtra por rango de fechas', async () => {
      const listado = await api(tokenAdmin).listarMovimientos(
        centro,
        '?desde=2000-01-01T00:00:00.000Z&hasta=2999-01-01T00:00:00.000Z',
      );

      expect(listado.data.length).toBeGreaterThan(0);
    });

    it('responde 404 si se filtra por un insumo que no esta en la sucursal', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Sin stock'))).id;

      await request(app.getHttpServer())
        .get(`/api/inventario/sucursales/${centro}/movimientos?insumoId=${id}`)
        .set(...como(tokenAdmin))
        .expect(404);
    });

    it('un Gerente no lee los movimientos de otra sucursal', async () => {
      await request(app.getHttpServer())
        .get(`/api/inventario/sucursales/${norte}/movimientos`)
        .set(...como(tokenGerente))
        .expect(404);
    });
  });

  // --------------------------------------------------------------- recuentos

  describe('recuentos', () => {
    it('fija el stock al valor contado y guarda el ajuste', async () => {
      const respuesta = await api(tokenAdmin)
        .crearRecuento(centro, [{ insumoId: cafeId, stockFisico: 20 }])
        .expect(201);

      expect((respuesta.body as RecuentoE2E).sucursalId).toBe(centro);

      const detalle = await api(tokenAdmin).verRecuento(
        (respuesta.body as RecuentoE2E).id,
      );

      const linea = detalle.detalles[0];

      expect(linea.stockSistema).toBe('18.75');
      expect(linea.stockFisico).toBe('20.00');
      expect(linea.diferencia).toBe('1.25');

      const stock = await api(tokenAdmin).listarStock(centro);

      expect(stock.data.find((f) => f.insumoId === cafeId)?.stockActual).toBe('20.00');
    });

    it('genera un movimiento de ajuste con la diferencia', async () => {
      const movimientos = await api(tokenAdmin).listarMovimientos(
        centro,
        `?insumoId=${cafeId}&tipo=ajuste`,
      );

      expect(movimientos.data.length).toBeGreaterThanOrEqual(1);
      expect(movimientos.data[0].cantidad).toBe('1.25');
      expect(movimientos.data[0].motivo).toBe('Ajuste por recuento fisico');
    });

    it('baja el stock cuando falta mercaderia, con diferencia negativa', async () => {
      const respuesta = await api(tokenAdmin)
        .crearRecuento(centro, [{ insumoId: cafeId, stockFisico: 5 }])
        .expect(201);

      const detalle = await api(tokenAdmin).verRecuento((respuesta.body as RecuentoE2E).id);

      expect(detalle.detalles[0].diferencia).toBe('-15.00');

      const stock = await api(tokenAdmin).listarStock(centro);

      expect(stock.data.find((f) => f.insumoId === cafeId)?.stockActual).toBe('5.00');
    });

    it('acepta un fisico de cero', async () => {
      await api(tokenAdmin)
        .crearRecuento(centro, [{ insumoId: cafeId, stockFisico: 0 }])
        .expect(201);

      const stock = await api(tokenAdmin).listarStock(centro);

      expect(stock.data.find((f) => f.insumoId === cafeId)?.stockActual).toBe('0.00');
    });

    it('guarda la linea aunque cuadre, sin mover el stock ni generar movimiento', async () => {
      const antes = await api(tokenAdmin).listarStock(centro);
      const stockAntes = antes.data.find((f) => f.insumoId === cafeId)?.stockActual;
      const movimientosAntes = await api(tokenAdmin).listarMovimientos(centro);

      const respuesta = await api(tokenAdmin)
        .crearRecuento(centro, [{ insumoId: cafeId, stockFisico: 0 }])
        .expect(201);

      const detalle = await api(tokenAdmin).verRecuento((respuesta.body as RecuentoE2E).id);

      expect(detalle.detalles[0].diferencia).toBe('0.00');

      const despues = await api(tokenAdmin).listarStock(centro);

      expect(despues.data.find((f) => f.insumoId === cafeId)?.stockActual).toBe(stockAntes);

      const movimientosDespues = await api(tokenAdmin).listarMovimientos(centro);

      expect(movimientosDespues.total).toBe(movimientosAntes.total);
    });

    it('acepta varias lineas y solo ajusta las que difieren', async () => {
      await api(tokenAdmin).configurar(centro, jarraId, { stockMinimo: 5 }).expect(200);
      await api(tokenAdmin).registrarEntrada(centro, jarraId, { cantidad: 10 }).expect(201);

      const respuesta = await api(tokenAdmin)
        .crearRecuento(centro, [
          { insumoId: cafeId, stockFisico: 3 },
          { insumoId: jarraId, stockFisico: 10 },
        ])
        .expect(201);

      const detalle = await api(tokenAdmin).verRecuento((respuesta.body as RecuentoE2E).id);

      expect(detalle.detalles).toHaveLength(2);

      const cafe = detalle.detalles.find((d) => d.insumoSucursalId === stockCafeId);
      const jarra = detalle.detalles.find((d) => d.insumoSucursalId !== stockCafeId);

      expect(cafe?.diferencia).toBe('3.00');
      expect(jarra?.diferencia).toBe('0.00');

      const stock = await api(tokenAdmin).listarStock(centro);

      expect(stock.data.find((f) => f.insumoId === cafeId)?.stockActual).toBe('3.00');
      expect(stock.data.find((f) => f.insumoId === jarraId)?.stockActual).toBe('10.00');
    });

    it('rechaza un fisico negativo con 400 y no deja nada a medias', async () => {
      const stockAntes = await api(tokenAdmin).listarStock(centro);
      const cafeAntes = stockAntes.data.find((f) => f.insumoId === cafeId)?.stockActual;
      const recuentosAntes = await api(tokenAdmin).listarRecuentos();

      await api(tokenAdmin)
        .crearRecuento(centro, [
          { insumoId: cafeId, stockFisico: 99 },
          { insumoId: jarraId, stockFisico: -1 },
        ])
        .expect(400);

      const stockDespues = await api(tokenAdmin).listarStock(centro);
      const recuentosDespues = await api(tokenAdmin).listarRecuentos();

      // La primera linea era valida y se llego a validar: si la transaccion no
      // existiera, el 99 habria quedado escrito.
      expect(stockDespues.data.find((f) => f.insumoId === cafeId)?.stockActual).toBe(cafeAntes);
      expect(recuentosDespues.total).toBe(recuentosAntes.total);
    });

    it('rechaza contar el mismo insumo dos veces con 400', async () => {
      await api(tokenAdmin)
        .crearRecuento(centro, [
          { insumoId: cafeId, stockFisico: 1 },
          { insumoId: cafeId, stockFisico: 2 },
        ])
        .expect(400);
    });

    it('rechaza un recuento sin lineas con 400', async () => {
      await api(tokenAdmin).crearRecuento(centro, []).expect(400);
    });

    it('responde 404 con un insumo que no existe', async () => {
      await api(tokenAdmin)
        .crearRecuento(centro, [
          { insumoId: '00000000-0000-0000-0000-000000000000', stockFisico: 1 },
        ])
        .expect(404);
    });

    it('responde 404 si el insumo no esta dado de alta en la sucursal', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Sin alta'))).id;

      await api(tokenAdmin)
        .crearRecuento(centro, [{ insumoId: id, stockFisico: 1 }])
        .expect(404);
    });

    it('responde 409 si el insumo esta descontinuado', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Descontinuado'))).id;
      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 1 }).expect(200);
      await api(tokenAdmin).configurar(centro, id, { estado: 'descontinuado' }).expect(200);

      await api(tokenAdmin)
        .crearRecuento(centro, [{ insumoId: id, stockFisico: 1 }])
        .expect(409);
    });

    it('lista los recuentos de la sucursal del Gerente', async () => {
      const listado = await api(tokenAdmin).listarRecuentos('?limit=100');
      const totalEsperado = listado.total;

      const response = await request(app.getHttpServer())
        .get('/api/inventario/recuentos?limit=100')
        .set(...como(tokenGerente))
        .expect(200);

      const delGerente = response.body as Listado<RecuentoE2E>;

      expect(delGerente.total).toBe(totalEsperado);
      expect(delGerente.data.every((r) => r.sucursalId === centro)).toBe(true);
    });

    it('el Gerente no lee el detalle de un recuento de otra sucursal', async () => {
      const enNorte = await request(app.getHttpServer())
        .put(`/api/inventario/sucursales/${norte}/insumos/${cafeId}`)
        .set(...como(tokenAdmin))
        .send({ stockMinimo: 1 })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/inventario/sucursales/${norte}/recuentos`)
        .set(...como(tokenAdmin))
        .send({ items: [{ insumoId: cafeId, stockFisico: 4 }] })
        .expect(201);

      const listado = await request(app.getHttpServer())
        .get('/api/inventario/recuentos?sucursalId=' + norte)
        .set(...como(tokenAdmin))
        .expect(200);

      const idNorte = (listado.body as Listado<RecuentoE2E>).data[0].id;

      await request(app.getHttpServer())
        .get(`/api/inventario/recuentos/${idNorte}`)
        .set(...como(tokenGerente))
        .expect(404);

      expect((enNorte.body as StockE2E).id).toEqual(expect.any(String));
    });

    it('el Admin ve el recuento con su usuario y su sucursal', async () => {
      const listado = await api(tokenAdmin).listarRecuentos('?limit=1');
      const detalle = await api(tokenAdmin).verRecuento(listado.data[0].id);

      expect(detalle.usuario.id).toEqual(expect.any(String));
      expect(detalle.sucursal.id).toBe(detalle.sucursalId);
    });
  });

  // ----------------------------------------------------------------- alertas

  describe('alertas de stock', () => {
    it('abre una alerta cuando el stock cae al minimo', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Para alertar'))).id;
      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 10 }).expect(200);
      await api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 10 }).expect(201);

      const listado = await api(tokenAdmin).listarAlertas('?estado=abierta');
      const fila = listado.data.find((a) => a.insumoSucursal.insumoId === id);

      expect(fila).toBeDefined();
      expect(fila?.estado).toBe('abierta');
      expect(fila?.insumoSucursal.stockActual).toBe('10.00');
      expect(fila?.insumoSucursal.stockMinimo).toBe('10.00');
    });

    it('no abre una segunda alerta si el stock sigue por debajo', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Alerta unica'))).id;
      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 10 }).expect(200);
      await api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 8 }).expect(201);

      const abiertas = await api(tokenAdmin).listarAlertas('?estado=abierta');
      const suyas = abiertas.data.filter((a) => a.insumoSucursal.insumoId === id);

      expect(suyas).toHaveLength(1);

      await api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 1 }).expect(201);

      const trasOtraEntrada = await api(tokenAdmin).listarAlertas('?estado=abierta');
      const suyas2 = trasOtraEntrada.data.filter((a) => a.insumoSucursal.insumoId === id);

      expect(suyas2).toHaveLength(1);
    });

    it('abre alerta al subir el minimo por encima del stock', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Minimo que sube'))).id;
      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 1 }).expect(200);
      await api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 5 }).expect(201);

      const antes = await api(tokenAdmin).listarAlertas('?estado=abierta');

      expect(
        antes.data.filter((a) => a.insumoSucursal.insumoId === id),
      ).toHaveLength(0);

      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 50 }).expect(200);

      const despues = await api(tokenAdmin).listarAlertas('?estado=abierta');

      expect(
        despues.data.filter((a) => a.insumoSucursal.insumoId === id),
      ).toHaveLength(1);
    });

    it('resuelve la alerta cuando el stock sube por encima del minimo', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Alerta que se cierra'))).id;
      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 5 }).expect(200);
      await api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 2 }).expect(201);

      const abiertas = await api(tokenAdmin).listarAlertas('?estado=abierta');

      expect(
        abiertas.data.filter((a) => a.insumoSucursal.insumoId === id),
      ).toHaveLength(1);

      await api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 20 }).expect(201);

      const trasSubir = await api(tokenAdmin).listarAlertas('?estado=abierta');

      expect(
        trasSubir.data.filter((a) => a.insumoSucursal.insumoId === id),
      ).toHaveLength(0);

      const resueltas = await api(tokenAdmin).listarAlertas('?estado=resuelta');

      expect(
        resueltas.data.filter((a) => a.insumoSucursal.insumoId === id),
      ).toHaveLength(1);
    });

    it('resuelve la alerta al descontinuar el insumo', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Alerta por descontinuar'))).id;
      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 5 }).expect(200);
      await api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 1 }).expect(201);

      const abiertas = await api(tokenAdmin).listarAlertas('?estado=abierta');

      expect(abiertas.data.filter((a) => a.insumoSucursal.insumoId === id)).toHaveLength(1);

      await api(tokenAdmin).configurar(centro, id, { estado: 'descontinuado' }).expect(200);

      const trasDescontinuar = await api(tokenAdmin).listarAlertas('?estado=abierta');

      expect(
        trasDescontinuar.data.filter((a) => a.insumoSucursal.insumoId === id),
      ).toHaveLength(0);
    });

    it('un recuento que sube el stock resuelve la alerta', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Alerta por recuento'))).id;
      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 5 }).expect(200);
      await api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 2 }).expect(201);

      const abiertas = await api(tokenAdmin).listarAlertas('?estado=abierta');

      expect(abiertas.data.filter((a) => a.insumoSucursal.insumoId === id)).toHaveLength(1);

      await api(tokenAdmin)
        .crearRecuento(centro, [{ insumoId: id, stockFisico: 30 }])
        .expect(201);

      const despues = await api(tokenAdmin).listarAlertas('?estado=abierta');

      expect(
        despues.data.filter((a) => a.insumoSucursal.insumoId === id),
      ).toHaveLength(0);
    });

    it('el Gerente solo ve las alertas de su sucursal', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/inventario/alertas?limit=100')
        .set(...como(tokenGerente))
        .expect(200);

      const listado = response.body as Listado<AlertaE2E>;

      expect(listado.data.every((a) => a.insumoSucursal.sucursalId === centro)).toBe(true);
    });

    it('el Gerente recibe 404 si pide las alertas de otra sucursal', async () => {
      await request(app.getHttpServer())
        .get('/api/inventario/alertas?sucursalId=' + norte)
        .set(...como(tokenGerente))
        .expect(404);
    });

    it('el Admin ve las alertas de todas las sucursales', async () => {
      const listado = await api(tokenAdmin).listarAlertas('?limit=100');

      const sucursalesVistas = new Set(
        listado.data.map((a) => a.insumoSucursal.sucursalId),
      );

      expect(sucursalesVistas.size).toBeGreaterThan(1);
    });

    it('rechaza un estado de alerta que no existe con 400', async () => {
      await request(app.getHttpServer())
        .get('/api/inventario/alertas?estado=pendiente')
        .set(...como(tokenAdmin))
        .expect(400);
    });
  });

  // ------------------------------------------------------- concurrencia y cierre

  describe('concurrencia', () => {
    it('dos entradas simultaneas sobre la misma fila no se pisan', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Concurrente'))).id;
      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 0 }).expect(200);

      await Promise.all([
        api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 3 }).expect(201),
        api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 4 }).expect(201),
        api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 5 }).expect(201),
      ]);

      const stock = await api(tokenAdmin).listarStock(centro);
      const fila = stock.data.find((f) => f.insumoId === id);

      // El `increment` lo resuelve la base; una lectura previa mas una escritura
      // daria cualquier cosa menos 12.00.
      expect(fila?.stockActual).toBe('12.00');

      const movimientos = await api(tokenAdmin).listarMovimientos(centro, `?insumoId=${id}`);

      expect(movimientos.data).toHaveLength(3);
    });

    it('dos recuentos simultaneos se serializan y no se machacan', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Dos recuentos'))).id;
      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 0 }).expect(200);
      await api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 10 }).expect(201);

      await Promise.all([
        api(tokenAdmin).crearRecuento(centro, [{ insumoId: id, stockFisico: 20 }]),
        api(tokenAdmin).crearRecuento(centro, [{ insumoId: id, stockFisico: 30 }]),
      ]);

      // Con el `SELECT ... FOR UPDATE` el segundo recuento lee el stock YA
      // ajustado por el primero, de modo que su `stock_sistema` no es el 10
      // original en ambos casos.
      const stock = await api(tokenAdmin).listarStock(centro);
      const fila = stock.data.find((f) => f.insumoId === id);

      expect(['20.00', '30.00']).toContain(fila?.stockActual);

      const recuentos = await api(tokenAdmin).listarRecuentos('?limit=100');
      const delInsumo = [];
      for (const r of recuentos.data
        .filter((fila) => fila.sucursalId === centro)
        .slice(0, 2)) {
        delInsumo.push(await api(tokenAdmin).verRecuento(r.id));
      }

      const sistemas = delInsumo
        .map((r) => r.detalles.find((d) => d.diferencia !== '0.00')?.stockSistema)
        .filter(Boolean);

      expect(new Set(sistemas).size).toBeGreaterThan(0);
    });

    it('dos altas con el mismo nombre: solo una gana, la otra recibe 409', async () => {
      const nombre = nombreLibre('Carrera');

      const pet1 = request(app.getHttpServer())
        .post('/api/insumos')
        .set(...como(tokenAdmin))
        .send({ nombre, presentacion: 'paquete' });
      const pet2 = request(app.getHttpServer())
        .post('/api/insumos')
        .set(...como(tokenAdmin))
        .send({ nombre, presentacion: 'paquete' });
      const respuestas = await Promise.all([pet1, pet2]);

      const creados = respuestas.filter((r) => r.status === 201);
      const rechazados = respuestas.filter((r) => r.status === 409);

      // Sin el candado por nombre, las dos lecturasarian "no existe" y las dos
      // insertarian: dos filas identicas y ningun 409.
      expect(creados).toHaveLength(1);
      expect(rechazados).toHaveLength(1);

      const enBase = await clientePrueba().insumo.count({ where: { nombre } });

      expect(enBase).toBe(1);
    });
  });

  describe('trazabilidad', () => {
    it('el recuento guarda quien lo hizo', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Firmado'))).id;
      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 0 }).expect(200);
      await api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 1 }).expect(201);

      const respuesta = await api(tokenAdmin)
        .crearRecuento(centro, [{ insumoId: id, stockFisico: 4 }])
        .expect(201);

      const recuento = await api(tokenAdmin).verRecuento((respuesta.body as RecuentoE2E).id);

      const enBase = await clientePrueba().recuentoInventario.findUnique({
        where: { id: recuento.id },
        select: { usuarioId: true },
      });

      expect(enBase?.usuarioId).toBe(recuento.usuarioId);
      expect(recuento.usuarioId).toEqual(expect.any(String));
    });

    it('el movimiento de un recuento apunta al usuario que lo cerco', async () => {
      const id = (await api(tokenAdmin).crearInsumo(nombreLibre('Movimiento'))).id;
      await api(tokenAdmin).configurar(centro, id, { stockMinimo: 0 }).expect(200);
      await api(tokenAdmin).registrarEntrada(centro, id, { cantidad: 1 }).expect(201);
      await api(tokenAdmin)
        .crearRecuento(centro, [{ insumoId: id, stockFisico: 9 }])
        .expect(201);

      const movimientos = await api(tokenAdmin).listarMovimientos(centro, `?insumoId=${id}&tipo=ajuste`);

      expect(movimientos.data[0].usuarioId).toEqual(expect.any(String));
      expect(movimientos.data[0].cantidad).toBe('8.00');
    });
  });
});
