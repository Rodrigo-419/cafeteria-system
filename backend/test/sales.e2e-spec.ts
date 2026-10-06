// Pruebas E2E del modulo de ventas: registro, consulta y anulacion.
//
// Preparacion: se reinicia la base UNA vez en `beforeAll` y, a continuacion, el
// Admin crea por HTTP la categoria, los productos y las ofertas que se van a
// vender, igual que haria un cliente real. El seed no crea catalogo, asi que si
// algo falta, la suite lo dice enseguida.
//
// Las ventas se van acumulando a lo largo del fichero: cada prueba se aferra a
// lo que puede controlar (su propia sucursal, su propio id, un total relativo)
// en vez de contar las filas de toda la base, para que el orden de declaracion
// no forme parte del contrato. Donde hace falta un dato que la API no puede
// producir (una venta de ayer) se retrocede `created_at` por el cliente de
// Prisma; es el unico sitio donde se escribe sin pasar por HTTP.
//
// Dos formas de error distintas y las dos se comprueban aqui: las que salen del
// DTO llegan como `message: string[]`, y las que lanza un caso de uso llegan
// como `message: string`.
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearAppDePruebas } from './utils/crear-app-pruebas';
import { clientePrueba, cerrarClientePrueba, resetDatabase } from './utils/reset-database';
import { como, iniciarSesion, tokenDeAdmin } from './utils/http-pruebas';
import {
  crearEmpleado,
  crearGerente,
  idDePermiso,
  idsDeSucursales,
  type Sucursales,
} from './utils/fixtures-pruebas';
import { idsDeVariantes, type Variantes } from './utils/fixtures-productos-pruebas';
import { PASSWORD_VALIDA_PRUEBAS } from './utils/constantes-pruebas';

// ------------------------------------------------------------------ respuestas

type Listado<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPaginas: number;
};

type DetalleE2E = {
  id: string;
  productoSucursalVarianteId: string;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
  producto: { id: string; nombre: string };
  variante: { id: string; nombre: string };
};

type VentaE2E = {
  id: string;
  sucursalId: string;
  usuarioId: string;
  metodoPago: string;
  estado: string;
  fechaAnulacion: string | null;
  usuarioAnuladorId: string | null;
  motivoAnulacion: string | null;
  createdAt: string;
  fecha: string;
  total: string;
  lineas: number;
  sucursal: { id: string; nombre: string };
  vendedor: { id: string; nombre: string };
  anulador: { id: string; nombre: string } | null;
  detalles?: DetalleE2E[];
};

type CategoriaE2E = { id: string; nombre: string };
type ProductoE2E = { id: string; nombre: string; categoriaId: string };

type CartaFilaE2E = {
  id: string;
  productoId: string;
  varianteId: string;
  precio: string;
  estado: string;
};

/** Mensajes de un error de la API, sea `string` o `string[]`. */
function mensajesDe(cuerpo: unknown): string[] {
  const mensaje = (cuerpo as { message?: string | string[] }).message;
  if (mensaje === undefined) {
    return [];
  }
  return Array.isArray(mensaje) ? mensaje : [mensaje];
}

/** Dia local del negocio (`America/Lima`) en formato `YYYY-MM-DD`. */
function diaLocal(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

// ------------------------------------------------------------------- atajos

function crearCategoriaPorHttp(
  app: INestApplication,
  token: string,
  nombre: string,
): Promise<CategoriaE2E> {
  return request(app.getHttpServer())
    .post('/api/product-categories')
    .set(...como(token))
    .send({ nombre })
    .expect(201)
    .then((r) => r.body as CategoriaE2E);
}

function crearProductoPorHttp(
  app: INestApplication,
  token: string,
  datos: { nombre: string; categoriaId: string },
): Promise<ProductoE2E> {
  return request(app.getHttpServer())
    .post('/api/products')
    .set(...como(token))
    .send(datos)
    .expect(201)
    .then((r) => r.body as ProductoE2E);
}

function rutaDeOferta(datos: {
  sucursalId: string;
  productoId: string;
  varianteId: string;
}): string {
  return `/api/branches/${datos.sucursalId}/products/${datos.productoId}/variants/${datos.varianteId}`;
}

function fijarOferta(
  app: INestApplication,
  token: string,
  datos: {
    sucursalId: string;
    productoId: string;
    varianteId: string;
    precio: number;
    estado?: string;
  },
): request.Test {
  return request(app.getHttpServer())
    .put(rutaDeOferta(datos))
    .set(...como(token))
    .send({
      precio: datos.precio,
      ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
    });
}

function leerCarta(
  app: INestApplication,
  token: string,
  sucursalId: string,
): Promise<CartaFilaE2E[]> {
  return request(app.getHttpServer())
    .get(`/api/branches/${sucursalId}/products`)
    .set(...como(token))
    .expect(200)
    .then((r) => r.body as CartaFilaE2E[]);
}

function tokenDeEmpleado(
  app: INestApplication,
  admin: string,
  sucursalId: string,
  nombre: string,
): Promise<string> {
  const email = `${nombre.toLowerCase().replace(/\s+/gu, '.')}@cafeteria.test`;

  return crearEmpleado(app, admin, sucursalId, nombre)
    .then(() => iniciarSesion(app, email, PASSWORD_VALIDA_PRUEBAS).expect(200))
    .then((r) => (r.body as { accessToken: string }).accessToken);
}

/** Cuerpo que el caso de uso espera recibir desde HTTP. */
function cuerpoVenta(
  items: { productoSucursalVarianteId: string; cantidad: number }[],
  metodoPago = 'efectivo',
) {
  return { metodoPago, items };
}

// ------------------------------------------------------------------ contexto

describe('ventas (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let sucursales: Sucursales;
  let variantes: Variantes;

  /** Gerente de Sucursal Centro: registra y anula. */
  let tokenCentro: string;
  let idGerenteCentro: string;
  /** Gerente de Sucursal Norte: para comprobar que no ve las de Centro. */
  let tokenNorte: string;
  /** Empleado de Centro sin permisos de ventas. */
  let tokenEmpleado: string;

  let prodCafe: string;
  let prodTarta: string;

  /** Ofertas de Centro, por su id de `producto_sucursal_variante`. */
  let ofertaCafe: string;
  let ofertaTarta: string;
  let ofertaInactiva: string;
  let ofertaCambiable: string;
  /** Oferta del cafe en Norte. */
  let ofertaNorte: string;

  /** Venta de referencia creada al arrancar, para leer y anular. */
  let ventaEjemplo: VentaE2E;

  beforeAll(async () => {
    app = await crearAppDePruebas();
    await resetDatabase(clientePrueba());

    admin = await tokenDeAdmin(app);
    sucursales = await idsDeSucursales();
    variantes = await idsDeVariantes();

    const gerenteCentro = await crearGerente(
      app,
      admin,
      sucursales.centro,
      'Gerente Venta Centro',
    );
    tokenCentro = gerenteCentro.token;
    idGerenteCentro = gerenteCentro.usuario.id;

    const gerenteNorte = await crearGerente(
      app,
      admin,
      sucursales.norte,
      'Gerente Venta Norte',
    );
    tokenNorte = gerenteNorte.token;

    tokenEmpleado = await tokenDeEmpleado(
      app,
      admin,
      sucursales.centro,
      'Empleado Venta',
    );

    // El catalogo: el Admin crea la categoria y los productos, y cada Gerente
    // fija los precios de su propia sucursal (ese permiso es suyo).
    const categoria = await crearCategoriaPorHttp(app, admin, 'Para vender');

    const cafe = await crearProductoPorHttp(app, admin, {
      nombre: 'Cafe de la casa',
      categoriaId: categoria.id,
    });
    const tarta = await crearProductoPorHttp(app, admin, {
      nombre: 'Tarta de la casa',
      categoriaId: categoria.id,
    });
    prodCafe = cafe.id;
    prodTarta = tarta.id;

    await fijarOferta(app, tokenCentro, {
      sucursalId: sucursales.centro,
      productoId: prodCafe,
      varianteId: variantes.chico,
      precio: 12.5,
    }).expect(200);
    await fijarOferta(app, tokenCentro, {
      sucursalId: sucursales.centro,
      productoId: prodTarta,
      varianteId: variantes.unica,
      precio: 0.1,
    }).expect(200);
    await fijarOferta(app, tokenCentro, {
      sucursalId: sucursales.centro,
      productoId: prodCafe,
      varianteId: variantes.grande,
      precio: 5,
      estado: 'inactivo',
    }).expect(200);
    await fijarOferta(app, tokenCentro, {
      sucursalId: sucursales.centro,
      productoId: prodTarta,
      varianteId: variantes.mediano,
      precio: 7,
    }).expect(200);
    await fijarOferta(app, tokenNorte, {
      sucursalId: sucursales.norte,
      productoId: prodCafe,
      varianteId: variantes.chico,
      precio: 99.9,
    }).expect(200);

    const idOferta = (
      carta: CartaFilaE2E[],
      productoId: string,
      varianteId: string,
    ): string => {
      const fila = carta.find(
        (f) => f.productoId === productoId && f.varianteId === varianteId,
      );
      if (!fila) {
        throw new Error(`La carta no incluye ${productoId}/${varianteId}`);
      }
      return fila.id;
    };

    const cartaCentro = await leerCarta(app, admin, sucursales.centro);
    const cartaNorte = await leerCarta(app, admin, sucursales.norte);

    ofertaCafe = idOferta(cartaCentro, prodCafe, variantes.chico);
    ofertaTarta = idOferta(cartaCentro, prodTarta, variantes.unica);
    ofertaInactiva = idOferta(cartaCentro, prodCafe, variantes.grande);
    ofertaCambiable = idOferta(cartaCentro, prodTarta, variantes.mediano);
    ofertaNorte = idOferta(cartaNorte, prodCafe, variantes.chico);

    const respuesta = await request(app.getHttpServer())
      .post('/api/sales')
      .set(...como(tokenCentro))
      .send(cuerpoVenta([{ productoSucursalVarianteId: ofertaCafe, cantidad: 1 }]))
      .expect(201);
    ventaEjemplo = respuesta.body as VentaE2E;
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  /** Envia un cuerpo literal a POST /sales. */
  function enviar(token: string, cuerpo: unknown): request.Test {
    return request(app.getHttpServer())
      .post('/api/sales')
      .set(...como(token))
      .send(cuerpo);
  }

  /** Registra una venta valida y devuelve la peticion para encadenar. */
  function registrar(
    token: string,
    items: { productoSucursalVarianteId: string; cantidad: number }[],
    metodoPago = 'efectivo',
  ): request.Test {
    return enviar(token, cuerpoVenta(items, metodoPago));
  }

  /** Venta de hoy en Centro, creada al vuelo para anular o leer. */
  async function ventaDeCentro(): Promise<VentaE2E> {
    const respuesta = await registrar(tokenCentro, [
      { productoSucursalVarianteId: ofertaTarta, cantidad: 2 },
    ]).expect(201);
    return respuesta.body as VentaE2E;
  }

  // ------------------------------------------------------- autorizacion

  describe('autorizacion', () => {
    it('sin token los cuatro endpoints responden 401', async () => {
      await request(app.getHttpServer()).post('/api/sales').expect(401);
      await request(app.getHttpServer()).get('/api/sales').expect(401);
      await request(app.getHttpServer()).get(`/api/sales/${ventaEjemplo.id}`).expect(401);
      await request(app.getHttpServer())
        .post(`/api/sales/${ventaEjemplo.id}/anular`)
        .expect(401);
    });

    it('el Admin no registra ni anula: 403', async () => {
      // `ventas.registrar` y `ventas.anular` son de Gerente; el Admin solo lee.
      const registro = await registrar(admin, [
        { productoSucursalVarianteId: ofertaCafe, cantidad: 1 },
      ]);
      expect(registro.status).toBe(403);
      expect(mensajesDe(registro.body)).toEqual(['Acceso denegado']);

      const anulacion = await request(app.getHttpServer())
        .post(`/api/sales/${ventaEjemplo.id}/anular`)
        .set(...como(admin))
        .send({ motivo: 'El Admin no anula' });
      expect(anulacion.status).toBe(403);
      expect(mensajesDe(anulacion.body)).toEqual(['Acceso denegado']);
    });

    it('el Empleado sin permisos no lee ni registra: 403', async () => {
      const listado = await request(app.getHttpServer())
        .get('/api/sales')
        .set(...como(tokenEmpleado));
      expect(listado.status).toBe(403);
      expect(mensajesDe(listado.body)).toEqual(['Acceso denegado']);

      const lectura = await request(app.getHttpServer())
        .get(`/api/sales/${ventaEjemplo.id}`)
        .set(...como(tokenEmpleado));
      expect(lectura.status).toBe(403);

      const registro = await registrar(tokenEmpleado, [
        { productoSucursalVarianteId: ofertaCafe, cantidad: 1 },
      ]);
      expect(registro.status).toBe(403);
    });

    it('el Empleado si puede anular: es permiso por defecto de su rol', async () => {
      const venta = await ventaDeCentro();

      const respuesta = await request(app.getHttpServer())
        .post(`/api/sales/${venta.id}/anular`)
        .set(...como(tokenEmpleado))
        .send({ motivo: 'Teclado mal calibrado' })
        .expect(200);

      expect((respuesta.body as VentaE2E).estado).toBe('anulada');
      expect((respuesta.body as VentaE2E).usuarioAnuladorId).not.toBe(idGerenteCentro);
    });

    it('conceder ventas.registrar a un Empleado le deja registrar, pero no leer', async () => {
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Concedido');
      const tokenConcedido = (
        await iniciarSesion(
          app,
          'empleado.concedido@cafeteria.test',
          PASSWORD_VALIDA_PRUEBAS,
        ).expect(200)
      ).body.accessToken as string;

      const permisoId = await idDePermiso('ventas.registrar');
      await request(app.getHttpServer())
        .put(`/api/users/${empleado.id}/permisos/${permisoId}`)
        .set(...como(tokenCentro))
        .send({ tipo: 'concedido' })
        .expect(204);

      // Los permisos se releen de la base en cada peticion, asi que no hace
      // falta volver a iniciar sesion para que el nuevo surta efecto.
      const registro = await registrar(tokenConcedido, [
        { productoSucursalVarianteId: ofertaTarta, cantidad: 1 },
      ]).expect(201);
      expect((registro.body as VentaE2E).sucursalId).toBe(sucursales.centro);

      const listado = await request(app.getHttpServer())
        .get('/api/sales')
        .set(...como(tokenConcedido));
      expect(listado.status).toBe(403);
      expect(mensajesDe(listado.body)).toEqual(['Acceso denegado']);
    });

    it('el Gerente de otra sucursal no ve ni anula: 404', async () => {
      const lectura = await request(app.getHttpServer())
        .get(`/api/sales/${ventaEjemplo.id}`)
        .set(...como(tokenNorte));
      expect(lectura.status).toBe(404);
      expect(mensajesDe(lectura.body)).toEqual(['La venta no existe']);

      const anulacion = await request(app.getHttpServer())
        .post(`/api/sales/${ventaEjemplo.id}/anular`)
        .set(...como(tokenNorte))
        .send({ motivo: 'Intento ajeno' });
      expect(anulacion.status).toBe(404);
      expect(mensajesDe(anulacion.body)).toEqual(['La venta no existe']);
    });
  });

  // ---------------------------------------------------------- registrar

  describe('POST /sales', () => {
    it('registra la venta con los precios congelados de la oferta', async () => {
      const respuesta = await registrar(
        tokenCentro,
        [
          { productoSucursalVarianteId: ofertaCafe, cantidad: 1 },
          { productoSucursalVarianteId: ofertaTarta, cantidad: 3 },
        ],
        'tarjeta',
      ).expect(201);

      const venta = respuesta.body as VentaE2E;

      // 12.50 x 1 + 0.10 x 3: con coma flotante el segundo subtotal saldria
      // 0.30000000000000004 y el total no seria 12.80.
      expect(venta.total).toBe('12.80');
      expect(venta.lineas).toBe(2);
      expect(venta.estado).toBe('completada');
      expect(venta.metodoPago).toBe('tarjeta');
      expect(venta.fecha).toBe(diaLocal());
      expect(venta.sucursalId).toBe(sucursales.centro);
      expect(venta.usuarioId).toBe(idGerenteCentro);
      expect(venta.vendedor.id).toBe(idGerenteCentro);
      expect(venta.anulador).toBeNull();
      expect(venta.fechaAnulacion).toBeNull();
      expect(venta.motivoAnulacion).toBeNull();

      const detalles = venta.detalles ?? [];
      expect(detalles).toHaveLength(2);
      expect(detalles.map((d) => d.precioUnitario)).toEqual(['12.50', '0.10']);
      expect(detalles.map((d) => d.subtotal)).toEqual(['12.50', '0.30']);
      expect(detalles[0].producto.nombre).toBe('Cafe de la casa');
      expect(detalles[0].variante.nombre).toBe('Chico');

      // La venta se puede releer y viene identica, con sus lineas.
      const releida = await request(app.getHttpServer())
        .get(`/api/sales/${venta.id}`)
        .set(...como(admin))
        .expect(200);
      expect(releida.body as VentaE2E).toMatchObject({
        id: venta.id,
        total: '12.80',
        lineas: 2,
        estado: 'completada',
      });
      expect((releida.body as VentaE2E).detalles).toHaveLength(2);
    });

    it('el cuerpo no puede elegir la sucursal ni los importes', async () => {
      // `forbidNonWhitelisted` convierte cualquier campo desconocido en 400:
      // ni la sucursal ni el precio pasan del cliente al caso de uso.
      const sucursalAjena = await enviar(tokenCentro, {
        metodoPago: 'efectivo',
        items: [{ productoSucursalVarianteId: ofertaCafe, cantidad: 1 }],
        sucursalId: sucursales.norte,
        total: '0.01',
      });
      expect(sucursalAjena.status).toBe(400);
      expect(mensajesDe(sucursalAjena.body).join(' ')).toContain('sucursalId');

      const precioAjeno = await enviar(tokenCentro, {
        metodoPago: 'efectivo',
        items: [{ productoSucursalVarianteId: ofertaCafe, cantidad: 1, precio: 0.01 }],
      });
      expect(precioAjeno.status).toBe(400);
      expect(mensajesDe(precioAjeno.body).join(' ')).toContain('precio');
    });

    it('la sucursal sale del usuario, no de la peticion', async () => {
      const respuesta = await registrar(tokenNorte, [
        { productoSucursalVarianteId: ofertaNorte, cantidad: 1 },
      ]).expect(201);

      expect((respuesta.body as VentaE2E).sucursalId).toBe(sucursales.norte);
      expect((respuesta.body as VentaE2E).vendedor.id).not.toBe(idGerenteCentro);
    });

    it('no se vende la oferta de otra sucursal: 404', async () => {
      const respuesta = await registrar(tokenNorte, [
        { productoSucursalVarianteId: ofertaCafe, cantidad: 1 },
      ]);

      expect(respuesta.status).toBe(404);
      expect(mensajesDe(respuesta.body)).toEqual(['La oferta no existe']);
    });

    it('una oferta inactiva no se vende: 409', async () => {
      const respuesta = await registrar(tokenCentro, [
        { productoSucursalVarianteId: ofertaInactiva, cantidad: 1 },
      ]);

      expect(respuesta.status).toBe(409);
      expect(mensajesDe(respuesta.body)).toEqual(['La oferta no esta activa']);
    });

    it('rechaza lineas y metodos de pago invalidos: 400', async () => {
      const comprobaciones: Array<{ cuerpo: unknown; esperado: string }> = [
        {
          cuerpo: cuerpoVenta([]),
          esperado: 'La venta debe incluir al menos un producto',
        },
        {
          cuerpo: cuerpoVenta([{ productoSucursalVarianteId: ofertaCafe, cantidad: 0 }]),
          esperado: 'La cantidad minima es 1',
        },
        {
          cuerpo: cuerpoVenta([{ productoSucursalVarianteId: 'no-es-uuid', cantidad: 1 }]),
          esperado: 'Cada linea debe indicar una oferta valida',
        },
        {
          cuerpo: cuerpoVenta(
            [{ productoSucursalVarianteId: ofertaCafe, cantidad: 1 }],
            'bizum',
          ),
          esperado: 'El metodo de pago debe ser uno de: efectivo, tarjeta',
        },
        {
          cuerpo: cuerpoVenta(
            Array.from({ length: 101 }, () => ({
              productoSucursalVarianteId: ofertaCafe,
              cantidad: 1,
            })),
          ),
          esperado: 'Una venta no puede incluir mas de 100 lineas',
        },
      ];

      for (const comprobacion of comprobaciones) {
        const respuesta = await enviar(tokenCentro, comprobacion.cuerpo);
        expect(respuesta.status).toBe(400);
        // Los errores de una linea llevan el prefijo de la propiedad
        // (`items.0....`), por eso se buscan y no se comparan tal cual.
        expect(mensajesDe(respuesta.body).join(' ')).toContain(comprobacion.esperado);
      }
    });

    it('cada venta es una fila nueva', async () => {
      const antes = await clientePrueba().venta.count();

      const primera = await registrar(tokenCentro, [
        { productoSucursalVarianteId: ofertaTarta, cantidad: 1 },
      ]).expect(201);
      const segunda = await registrar(tokenCentro, [
        { productoSucursalVarianteId: ofertaTarta, cantidad: 1 },
      ]).expect(201);

      expect((primera.body as VentaE2E).id).not.toBe((segunda.body as VentaE2E).id);
      expect(await clientePrueba().venta.count()).toBe(antes + 2);
    });
  });

  // ------------------------------------------------------------ obtener

  describe('GET /sales/:id', () => {
    it('devuelve la venta con sus lineas y sus totales', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(`/api/sales/${ventaEjemplo.id}`)
        .set(...como(admin))
        .expect(200);

      const venta = respuesta.body as VentaE2E;
      expect(venta.id).toBe(ventaEjemplo.id);
      expect(venta.estado).toBe('completada');
      expect(venta.total).toBe('12.50');
      expect(venta.lineas).toBe(1);
      expect(venta.sucursal.id).toBe(sucursales.centro);
      expect(venta.fecha).toBe(diaLocal());
      expect(venta.detalles).toHaveLength(1);
      expect(venta.detalles?.[0].precioUnitario).toBe('12.50');
      expect(venta.detalles?.[0].subtotal).toBe('12.50');
    });

    it('un id inexistente responde 404 y uno que no es uuid, 400', async () => {
      const inexistente = await request(app.getHttpServer())
        .get('/api/sales/11111111-1111-4111-8111-111111111111')
        .set(...como(admin));
      expect(inexistente.status).toBe(404);
      expect(mensajesDe(inexistente.body)).toEqual(['La venta no existe']);

      const burdo = await request(app.getHttpServer())
        .get('/api/sales/no-es-uuid')
        .set(...como(admin));
      expect(burdo.status).toBe(400);
    });
  });

  // ------------------------------------------------------------ anular

  describe('POST /sales/:id/anular', () => {
    it('anula con motivo y deja quien, cuando y por que', async () => {
      const venta = await ventaDeCentro();

      const respuesta = await request(app.getHttpServer())
        .post(`/api/sales/${venta.id}/anular`)
        .set(...como(tokenCentro))
        .send({ motivo: '  Teclado mal calibrado  ' })
        .expect(200);

      const anulada = respuesta.body as VentaE2E;
      expect(anulada.estado).toBe('anulada');
      expect(anulada.motivoAnulacion).toBe('Teclado mal calibrado');
      expect(anulada.usuarioAnuladorId).toBe(idGerenteCentro);
      expect(anulada.anulador?.id).toBe(idGerenteCentro);
      expect(anulada.fechaAnulacion).not.toBeNull();
      // Los importes no cambian: anular no recalcula nada.
      expect(anulada.total).toBe(venta.total);
      expect(anulada.lineas).toBe(1);
    });

    it('una venta anulada no se anula dos veces: 409', async () => {
      const venta = await ventaDeCentro();

      await request(app.getHttpServer())
        .post(`/api/sales/${venta.id}/anular`)
        .set(...como(tokenCentro))
        .send({ motivo: 'Primera vez' })
        .expect(200);

      const segunda = await request(app.getHttpServer())
        .post(`/api/sales/${venta.id}/anular`)
        .set(...como(tokenCentro))
        .send({ motivo: 'Segunda vez' });

      expect(segunda.status).toBe(409);
      expect(mensajesDe(segunda.body)).toEqual(['La venta ya esta anulada']);
    });

    it('exige un motivo: 400', async () => {
      const venta = await ventaDeCentro();

      const vacio = await request(app.getHttpServer())
        .post(`/api/sales/${venta.id}/anular`)
        .set(...como(tokenCentro))
        .send({ motivo: '   ' });
      expect(vacio.status).toBe(400);
      expect(mensajesDe(vacio.body)).toEqual([
        'El motivo de la anulacion no puede estar vacio',
      ]);

      const ausente = await request(app.getHttpServer())
        .post(`/api/sales/${venta.id}/anular`)
        .set(...como(tokenCentro))
        .send({});
      expect(ausente.status).toBe(400);
      expect(mensajesDe(ausente.body)).toContain('El motivo debe ser texto');

      // La venta sigue intacta tras los dos intentos fallidos.
      const fila = await clientePrueba().venta.findUnique({
        where: { id: venta.id },
        select: { estado: true, motivoAnulacion: true },
      });
      expect(fila?.estado).toBe('completada');
      expect(fila?.motivoAnulacion).toBeNull();
    });

    it('una venta inexistente responde 404', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/sales/11111111-1111-4111-8111-111111111111/anular')
        .set(...como(tokenCentro))
        .send({ motivo: 'No existe' });

      expect(respuesta.status).toBe(404);
      expect(mensajesDe(respuesta.body)).toEqual(['La venta no existe']);
    });

    it('no se anula una venta de ayer: 409', async () => {
      const venta = await ventaDeCentro();
      const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // La API no puede producir una venta antigua; se retrocede `created_at`.
      await clientePrueba().venta.update({
        where: { id: venta.id },
        data: { createdAt: ayer },
      });

      const respuesta = await request(app.getHttpServer())
        .post(`/api/sales/${venta.id}/anular`)
        .set(...como(tokenCentro))
        .send({ motivo: 'Se me paso el dia' });

      expect(respuesta.status).toBe(409);
      expect(mensajesDe(respuesta.body)).toEqual([
        'Solo se pueden anular ventas del mismo dia',
      ]);

      const fila = await clientePrueba().venta.findUnique({
        where: { id: venta.id },
        select: { estado: true },
      });
      expect(fila?.estado).toBe('completada');
    });

    it('la venta anulada sigue en la base y sale en el listado', async () => {
      const venta = await ventaDeCentro();

      await request(app.getHttpServer())
        .post(`/api/sales/${venta.id}/anular`)
        .set(...como(tokenCentro))
        .send({ motivo: 'Cliente se equivoco de tamanho' })
        .expect(200);

      const fila = await clientePrueba().venta.findUnique({
        where: { id: venta.id },
        select: { id: true, estado: true, motivoAnulacion: true },
      });
      expect(fila).not.toBeNull();
      expect(fila?.estado).toBe('anulada');

      const detalle = await clientePrueba().ventaDetalle.findMany({
        where: { ventaId: venta.id },
      });
      expect(detalle).toHaveLength(1);

      const listado = await request(app.getHttpServer())
        .get('/api/sales')
        .query({ sucursalId: sucursales.centro, estado: 'anulada', limit: 100 })
        .set(...como(admin))
        .expect(200);

      const ids = (listado.body as Listado<VentaE2E>).data.map((f) => f.id);
      expect(ids).toContain(venta.id);
    });
  });

  // ------------------------------------------------------------ listar

  describe('GET /sales', () => {
    it('envuelve el listado en data, total, page, limit y totalPaginas', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/api/sales')
        .query({ limit: 5, page: 1 })
        .set(...como(admin))
        .expect(200);

      const cuerpo = respuesta.body as Listado<VentaE2E>;
      expect(Object.keys(cuerpo).sort()).toEqual([
        'data',
        'limit',
        'page',
        'total',
        'totalPaginas',
      ]);
      expect(Array.isArray(cuerpo.data)).toBe(true);
      expect(cuerpo.data.length).toBeGreaterThan(0);
      expect(cuerpo.data.length).toBeLessThanOrEqual(5);
      expect(cuerpo.page).toBe(1);
      expect(cuerpo.limit).toBe(5);
      expect(cuerpo.totalPaginas).toBe(Math.ceil(cuerpo.total / 5));
      expect(cuerpo.total).toBeGreaterThanOrEqual(cuerpo.data.length);
      // Las mas recientes primero: todas las de hoy, por eso no se comprueba
      // la hora, solo el dia local.
      expect(cuerpo.data[0].fecha).toBe(diaLocal());
    });

    it('pagina hasta el final sin repetir ventas', async () => {
      const completa = await request(app.getHttpServer())
        .get('/api/sales')
        .query({ limit: 100, page: 1 })
        .set(...como(admin))
        .expect(200);
      const total = (completa.body as Listado<VentaE2E>).total;
      expect(total).toBeGreaterThan(0);

      const ids = new Set<string>();
      const paginas = Math.ceil(total / 3);

      for (let page = 1; page <= paginas; page += 1) {
        const respuesta = await request(app.getHttpServer())
          .get('/api/sales')
          .query({ limit: 3, page })
          .set(...como(admin))
          .expect(200);
        for (const fila of (respuesta.body as Listado<VentaE2E>).data) {
          ids.add(fila.id);
        }
      }

      expect(ids.size).toBe(total);
    });

    it('filtra por estado, metodo de pago, sucursal y fecha', async () => {
      const anulada = await ventaDeCentro();
      await request(app.getHttpServer())
        .post(`/api/sales/${anulada.id}/anular`)
        .set(...como(tokenCentro))
        .send({ motivo: 'Para el filtro' })
        .expect(200);

      const porEstado = await request(app.getHttpServer())
        .get('/api/sales')
        .query({ estado: 'anulada', sucursalId: sucursales.centro, limit: 100 })
        .set(...como(admin))
        .expect(200);
      const anuladas = (porEstado.body as Listado<VentaE2E>).data;
      expect(anuladas.length).toBeGreaterThan(0);
      expect(anuladas.every((f) => f.estado === 'anulada')).toBe(true);
      expect(anuladas.map((f) => f.id)).toContain(anulada.id);

      const porMetodo = await request(app.getHttpServer())
        .get('/api/sales')
        .query({ metodoPago: 'tarjeta', limit: 100 })
        .set(...como(admin))
        .expect(200);
      const tarjetas = (porMetodo.body as Listado<VentaE2E>).data;
      expect(tarjetas.length).toBeGreaterThan(0);
      expect(tarjetas.every((f) => f.metodoPago === 'tarjeta')).toBe(true);

      const porSucursal = await request(app.getHttpServer())
        .get('/api/sales')
        .query({ sucursalId: sucursales.norte, limit: 100 })
        .set(...como(admin))
        .expect(200);
      const delNorte = (porSucursal.body as Listado<VentaE2E>).data;
      expect(delNorte.length).toBeGreaterThan(0);
      expect(delNorte.every((f) => f.sucursalId === sucursales.norte)).toBe(true);

      const porFecha = await request(app.getHttpServer())
        .get('/api/sales')
        .query({ fecha: diaLocal(), limit: 100 })
        .set(...como(admin))
        .expect(200);
      expect((porFecha.body as Listado<VentaE2E>).total).toBeGreaterThan(0);

      const diaVacio = await request(app.getHttpServer())
        .get('/api/sales')
        .query({ fecha: '2020-01-01' })
        .set(...como(admin))
        .expect(200);
      expect(diaVacio.body as Listado<VentaE2E>).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPaginas: 0,
      });
    });

    it('responde 400 con un filtro que no es valido', async () => {
      const comprobaciones: Array<[Record<string, string>, string]> = [
        [{ estado: 'fantasma' }, 'El filtro estado debe ser uno de: completada, anulada'],
        [{ metodoPago: 'bizum' }, 'El filtro metodoPago debe ser uno de: efectivo, tarjeta'],
        [{ fecha: '2026-02-30' }, 'La fecha debe ser un dia valido en formato YYYY-MM-DD'],
        [{ fecha: 'ayer' }, 'La fecha debe ser un dia valido en formato YYYY-MM-DD'],
        [
          { sucursalId: 'no-es-uuid' },
          'El filtro sucursalId debe ser un identificador valido',
        ],
        [{ limit: '101' }, 'limit no puede exceder 100'],
        [{ page: '0' }, 'page debe ser mayor o igual a 1'],
      ];

      for (const [query, esperado] of comprobaciones) {
        const respuesta = await request(app.getHttpServer())
          .get('/api/sales')
          .query(query)
          .set(...como(admin));
        expect(respuesta.status).toBe(400);
        expect(mensajesDe(respuesta.body)).toEqual([esperado]);
      }
    });

    it('responde 404 con una sucursal desconocida o fuera de alcance', async () => {
      const desconocida = await request(app.getHttpServer())
        .get('/api/sales')
        .query({ sucursalId: '11111111-1111-4111-8111-111111111111' })
        .set(...como(admin));
      expect(desconocida.status).toBe(404);
      expect(mensajesDe(desconocida.body)).toEqual(['La sucursal no existe']);

      const ajena = await request(app.getHttpServer())
        .get('/api/sales')
        .query({ sucursalId: sucursales.centro })
        .set(...como(tokenNorte));
      expect(ajena.status).toBe(404);
      expect(mensajesDe(ajena.body)).toEqual(['La sucursal no existe']);
    });

    it('el Gerente solo ve las ventas de su sucursal', async () => {
      const delCentro = await ventaDeCentro();
      await registrar(tokenNorte, [
        { productoSucursalVarianteId: ofertaNorte, cantidad: 4 },
      ]).expect(201);

      const respuesta = await request(app.getHttpServer())
        .get('/api/sales')
        .query({ limit: 100 })
        .set(...como(tokenNorte))
        .expect(200);

      const filas = (respuesta.body as Listado<VentaE2E>).data;
      expect(filas.length).toBeGreaterThan(0);
      expect(filas.every((f) => f.sucursalId === sucursales.norte)).toBe(true);
      expect(filas.map((f) => f.id)).not.toContain(delCentro.id);
    });
  });

  // -------------------------------------------------------- inmutabilidad

  describe('inmutabilidad', () => {
    it('no hay PUT, PATCH ni DELETE sobre una venta', async () => {
      const id = ventaEjemplo.id;

      const put = await request(app.getHttpServer())
        .put(`/api/sales/${id}`)
        .set(...como(admin))
        .send({ estado: 'anulada' });
      const patch = await request(app.getHttpServer())
        .patch(`/api/sales/${id}`)
        .set(...como(admin))
        .send({ total: '0.01' });
      const del = await request(app.getHttpServer())
        .delete(`/api/sales/${id}`)
        .set(...como(admin));

      expect(put.status).toBe(404);
      expect(patch.status).toBe(404);
      expect(del.status).toBe(404);

      const fila = await clientePrueba().venta.findUnique({
        where: { id },
        select: { estado: true, motivoAnulacion: true },
      });
      expect(fila?.estado).toBe('completada');
      expect(fila?.motivoAnulacion).toBeNull();
    });

    it('cambiar el precio de la carta no cambia lo ya vendido', async () => {
      const antesDeVender = await registrar(tokenCentro, [
        { productoSucursalVarianteId: ofertaCambiable, cantidad: 1 },
      ]).expect(201);
      const ventaVieja = antesDeVender.body as VentaE2E;
      expect(ventaVieja.total).toBe('7.00');
      expect(ventaVieja.detalles?.[0].precioUnitario).toBe('7.00');

      await fijarOferta(app, tokenCentro, {
        sucursalId: sucursales.centro,
        productoId: prodTarta,
        varianteId: variantes.mediano,
        precio: 9,
      }).expect(200);

      const despuesDeVender = await registrar(tokenCentro, [
        { productoSucursalVarianteId: ofertaCambiable, cantidad: 1 },
      ]).expect(201);
      const ventaNueva = despuesDeVender.body as VentaE2E;
      expect(ventaNueva.total).toBe('9.00');

      // La venta antigua sigue contando lo que se cobro.
      const releida = await request(app.getHttpServer())
        .get(`/api/sales/${ventaVieja.id}`)
        .set(...como(admin))
        .expect(200);
      expect((releida.body as VentaE2E).total).toBe('7.00');
      expect((releida.body as VentaE2E).detalles?.[0].precioUnitario).toBe('7.00');
    });
  });
});
