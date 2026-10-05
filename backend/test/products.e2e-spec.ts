// Pruebas E2E del modulo de productos: catalogo global, carta por sucursal y
// precios.
//
// Todos los ids de sucursal, variante, categoria y producto se leen de la base
// porque el seed genera UUIDs v7 nuevas en cada reset. El Admin crea el catalogo
// por HTTP, igual que haria un cliente real, para no escribir en las tablas del
// catalogo por la puerta de atrás.
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearAppDePruebas } from './utils/crear-app-pruebas';
import { clientePrueba, cerrarClientePrueba, resetDatabase } from './utils/reset-database';
import { como, iniciarSesion, tokenDeAdmin } from './utils/http-pruebas';
import {
  crearEmpleado,
  crearGerente,
  idsDeSucursales,
  type Sucursales,
} from './utils/fixtures-pruebas';
import { idsDeVariantes, type Variantes } from './utils/fixtures-productos-pruebas';
import { PASSWORD_VALIDA_PRUEBAS } from './utils/constantes-pruebas';

// ------------------------------------------------------------------ respuestas

type CategoriaE2E = {
  id: string;
  nombre: string;
  createdAt: string;
  updatedAt: string;
};

type VarianteE2E = {
  id: string;
  nombre: string;
  createdAt: string;
  updatedAt: string;
};

type ProductoE2E = {
  id: string;
  nombre: string;
  categoriaId: string;
  descripcion: string | null;
  createdAt: string;
  updatedAt: string;
  categoria: { id: string; nombre: string };
};

type CartaFilaE2E = {
  id: string;
  productoId: string;
  varianteId: string;
  precio: string;
  estado: string;
  producto: {
    id: string;
    nombre: string;
    categoriaId: string;
    categoria: { id: string; nombre: string };
  };
  variante: { id: string; nombre: string };
};

type OfertaE2E = { precio: string; estado: string };

type ListadoProductosE2E = {
  data: ProductoE2E[];
  total: number;
  page: number;
  limit: number;
  totalPaginas: number;
};

// ------------------------------------------------------------------- atajos

/**
 * El nombre de la variante base tal como lo deja el seed, escrito aqui para que
 * el fichero de pruebas se lea sin importar el modulo de dominio. Si el seed
 * cambiara el nombre, la prueba falla: que es justo lo que se quiere.
 */
const NOMBRE_VARIANTE_BASE = 'Única';

type Cliente = { token: string };

function crearCategoriaPorHttp(
  app: INestApplication,
  cliente: Cliente,
  nombre: string,
): Promise<CategoriaE2E> {
  return request(app.getHttpServer())
    .post('/api/product-categories')
    .set(...como(cliente.token))
    .send({ nombre })
    .expect(201)
    .then((r) => r.body as CategoriaE2E);
}

function crearVariantePorHttp(
  app: INestApplication,
  cliente: Cliente,
  nombre: string,
): Promise<VarianteE2E> {
  return request(app.getHttpServer())
    .post('/api/variants')
    .set(...como(cliente.token))
    .send({ nombre })
    .expect(201)
    .then((r) => r.body as VarianteE2E);
}

function crearProductoPorHttp(
  app: INestApplication,
  cliente: Cliente,
  datos: { nombre: string; categoriaId: string; descripcion?: string },
): Promise<ProductoE2E> {
  return request(app.getHttpServer())
    .post('/api/products')
    .set(...como(cliente.token))
    .send({
      nombre: datos.nombre,
      categoriaId: datos.categoriaId,
      ...(datos.descripcion !== undefined ? { descripcion: datos.descripcion } : {}),
    })
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
    precio: number | string;
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

/**
 * Envia el cuerpo como texto JSON literal.
 *
 * Necesario para el caso de la notacion exponencial: al pasar por
 * `JSON.stringify`, un numero como `1e-7` se convierte en texto y el DTO
 * recibiria una cadena, que ya falla por no ser numero. Para que el servidor
 * reciba de verdad un *numero* en notacion exponencial hay que escribir el JSON
 * a mano.
 */
function fijarOfertaConJsonLiteral(
  app: INestApplication,
  token: string,
  destino: { sucursalId: string; productoId: string; varianteId: string },
  cuerpo: string,
): request.Test {
  return request(app.getHttpServer())
    .put(rutaDeOferta(destino))
    .set(...como(token))
    .set('Content-Type', 'application/json')
    .send(cuerpo);
}

function leerCarta(app: INestApplication, token: string, sucursalId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/branches/${sucursalId}/products`)
    .set(...como(token));
}

/** Token de un Empleado recien creado en la sucursal indicada. */
async function tokenDeEmpleado(
  app: INestApplication,
  admin: string,
  sucursalId: string,
  nombre: string,
): Promise<string> {
  const email = `${nombre.toLowerCase().replace(/\s+/gu, '.')}@cafeteria.test`;
  await crearEmpleado(app, admin, sucursalId, nombre);

  const respuesta = await iniciarSesion(app, email, PASSWORD_VALIDA_PRUEBAS).expect(200);
  return (respuesta.body as { accessToken: string }).accessToken;
}

describe('products (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let sucursales: Sucursales;
  let variantes: Variantes;

  beforeAll(async () => {
    app = await crearAppDePruebas();
  });

  beforeEach(async () => {
    await resetDatabase(clientePrueba());
    admin = await tokenDeAdmin(app);
    sucursales = await idsDeSucursales();
    variantes = await idsDeVariantes();
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  // ------------------------------------------------------- catalogo: lecturas

  describe('GET /product-categories y /variants', () => {
    it('el Admin lista las categorias y las variantes del seed', async () => {
      const categorias = await request(app.getHttpServer())
        .get('/api/product-categories')
        .set(...como(admin))
        .expect(200);
      const lista = await request(app.getHttpServer())
        .get('/api/variants')
        .set(...como(admin))
        .expect(200);

      expect(Array.isArray(categorias.body)).toBe(true);
      expect(lista.body).toHaveLength(4);
      expect(
        (lista.body as VarianteE2E[]).map((v) => v.nombre).sort(),
      ).toEqual(['Chico', 'Grande', 'Mediano', NOMBRE_VARIANTE_BASE].sort());
    });

    it('el Gerente y el Empleado tambien leen el catalogo', async () => {
      const { token: gerente } = await crearGerente(
        app,
        admin,
        sucursales.norte,
        'Gerente Norte',
      );
      const empleado = await tokenDeEmpleado(app, admin, sucursales.norte, 'Empleado Norte');

      await request(app.getHttpServer())
        .get('/api/product-categories')
        .set(...como(gerente))
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/variants')
        .set(...como(empleado))
        .expect(200);
    });

    it('sin token responde 401', async () => {
      await request(app.getHttpServer()).get('/api/products').expect(401);
      await request(app.getHttpServer()).get('/api/variants').expect(401);
    });

    it('obtiene una variante por id y da 404 si no existe', async () => {
      await request(app.getHttpServer())
        .get(`/api/variants/${variantes.chico}`)
        .set(...como(admin))
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/variants/11111111-1111-4111-8111-111111111111')
        .set(...como(admin))
        .expect(404);
    });

    it('rechaza un id que no es uuid con 400', async () => {
      await request(app.getHttpServer())
        .get('/api/variants/no-es-uuid')
        .set(...como(admin))
        .expect(400);
    });
  });

  // --------------------------------------------------- catalogo: escrituras

  describe('catalogo: permiso de edicion', () => {
    it('el Gerente no puede crear categorias: 403', async () => {
      const { token } = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');

      await request(app.getHttpServer())
        .post('/api/product-categories')
        .set(...como(token))
        .send({ nombre: 'Categoria Prohibida' })
        .expect(403);
    });

    it('el Empleado no puede crear productos: 403', async () => {
      const token = await tokenDeEmpleado(app, admin, sucursales.norte, 'Empleado Norte');
      const categoria = await crearCategoriaPorHttp(app, { token: admin }, 'Bebidas');

      await request(app.getHttpServer())
        .post('/api/products')
        .set(...como(token))
        .send({ nombre: 'Cafe', categoriaId: categoria.id })
        .expect(403);
    });
  });

  describe('categorias', () => {
    it('el Admin crea, lee, renombra y borra una categoria vacia', async () => {
      const cliente = { token: admin };
      const creada = await crearCategoriaPorHttp(app, cliente, 'Postres');
      expect(creada.nombre).toBe('Postres');

      const leida = await request(app.getHttpServer())
        .get(`/api/product-categories/${creada.id}`)
        .set(...como(admin))
        .expect(200);
      expect((leida.body as CategoriaE2E).nombre).toBe('Postres');

      await request(app.getHttpServer())
        .patch(`/api/product-categories/${creada.id}`)
        .set(...como(admin))
        .send({ nombre: 'Dulces' })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/product-categories/${creada.id}`)
        .set(...como(admin))
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/product-categories/${creada.id}`)
        .set(...como(admin))
        .expect(404);
    });

    it('devuelve 409 con nombre duplicado, ignorando mayusculas y espacios', async () => {
      const cliente = { token: admin };
      await crearCategoriaPorHttp(app, cliente, 'Bebidas');

      await request(app.getHttpServer())
        .post('/api/product-categories')
        .set(...como(admin))
        .send({ nombre: '  bebidas  ' })
        .expect(409);
    });

    it('devuelve 409 al borrar una categoria con productos', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      await crearProductoPorHttp(app, cliente, { nombre: 'Cafe', categoriaId: categoria.id });

      await request(app.getHttpServer())
        .delete(`/api/product-categories/${categoria.id}`)
        .set(...como(admin))
        .expect(409);
    });

    it('devuelve 400 si el nombre es demasiado corto o falta', async () => {
      await request(app.getHttpServer())
        .post('/api/product-categories')
        .set(...como(admin))
        .send({ nombre: 'a' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/product-categories')
        .set(...como(admin))
        .send({})
        .expect(400);
    });

    it('da 404 al renombrar o borrar una categoria inexistente', async () => {
      const id = '11111111-1111-4111-8111-111111111111';

      await request(app.getHttpServer())
        .patch(`/api/product-categories/${id}`)
        .set(...como(admin))
        .send({ nombre: 'Cualquiera' })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/api/product-categories/${id}`)
        .set(...como(admin))
        .expect(404);
    });
  });

  describe('variantes', () => {
    it('el Admin crea y renombra una variante nueva', async () => {
      const cliente = { token: admin };
      const creada = await crearVariantePorHttp(app, cliente, 'Sin Azucar');

      await request(app.getHttpServer())
        .patch(`/api/variants/${creada.id}`)
        .set(...como(admin))
        .send({ nombre: 'Zero Azucar' })
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/variants/${creada.id}`)
        .set(...como(admin))
        .expect(200)
        .expect((r) => {
          expect((r.body as VarianteE2E).nombre).toBe('Zero Azucar');
        });
    });

    it('devuelve 409 con nombre duplicado', async () => {
      await request(app.getHttpServer())
        .post('/api/variants')
        .set(...como(admin))
        .send({ nombre: '  chico ' })
        .expect(409);
    });

    it('no deja renombrar la variante base', async () => {
      await request(app.getHttpServer())
        .patch(`/api/variants/${variantes.unica}`)
        .set(...como(admin))
        .send({ nombre: 'Simple' })
        .expect(409);
    });

    it('no deja borrar la variante base', async () => {
      await request(app.getHttpServer())
        .delete(`/api/variants/${variantes.unica}`)
        .set(...como(admin))
        .expect(409);
    });

    it('no deja crear una segunda variante base', async () => {
      await request(app.getHttpServer())
        .post('/api/variants')
        .set(...como(admin))
        .send({ nombre: 'única' })
        .expect(409);
    });

    it('devuelve 409 al borrar una variante con precios', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });
      // El precio lo fija un Gerente: el Admin no tiene `productos.precio.editar`.
      const gerente = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');

      await fijarOferta(app, gerente.token, {
        sucursalId: sucursales.norte,
        productoId: producto.id,
        varianteId: variantes.chico,
        precio: 1.5,
      }).expect(200);

      await request(app.getHttpServer())
        .delete(`/api/variants/${variantes.chico}`)
        .set(...como(admin))
        .expect(409);
    });

    it('borra una variante sin precios', async () => {
      const cliente = { token: admin };
      const creada = await crearVariantePorHttp(app, cliente, 'Temporal');

      await request(app.getHttpServer())
        .delete(`/api/variants/${creada.id}`)
        .set(...como(admin))
        .expect(204);
    });
  });

  describe('productos', () => {
    it('el Admin crea un producto y lo lee con su categoria', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const creado = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
        descripcion: 'Blend de la casa',
      });

      expect(creado.descripcion).toBe('Blend de la casa');
      expect(creado.categoria).toEqual({ id: categoria.id, nombre: 'Bebidas' });

      const leido = await request(app.getHttpServer())
        .get(`/api/products/${creado.id}`)
        .set(...como(admin))
        .expect(200);
      expect((leido.body as ProductoE2E).nombre).toBe('Cafe');
    });

    it('devuelve 400 si la categoria no existe', async () => {
      await request(app.getHttpServer())
        .post('/api/products')
        .set(...como(admin))
        .send({
          nombre: 'Cafe',
          categoriaId: '11111111-1111-4111-8111-111111111111',
        })
        .expect(400);
    });

    it('devuelve 409 con nombre duplicado en la misma categoria', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      await crearProductoPorHttp(app, cliente, { nombre: 'Cafe', categoriaId: categoria.id });

      await request(app.getHttpServer())
        .post('/api/products')
        .set(...como(admin))
        .send({ nombre: '  CAFE ', categoriaId: categoria.id })
        .expect(409);
    });

    it('permite el mismo nombre en otra categoria', async () => {
      const cliente = { token: admin };
      const bebidas = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const comidas = await crearCategoriaPorHttp(app, cliente, 'Comidas');

      await crearProductoPorHttp(app, cliente, { nombre: 'Especial', categoriaId: bebidas.id });

      // El mismo nombre en otra categoria no choca: la unicidad es por categoria.
      await crearProductoPorHttp(app, cliente, {
        nombre: 'Especial',
        categoriaId: comidas.id,
      });
    });

    it('al mover un producto comprueba el nombre contra la categoria de destino', async () => {
      const cliente = { token: admin };
      const bebidas = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const comidas = await crearCategoriaPorHttp(app, cliente, 'Comidas');

      // "Especial" ya existe en Bebidas, y es el nombre que lleva el producto
      // que se quiere mover a Comidas: si al mover no se mirase la categoria de
      // destino, la peticion pasaria y dejaria dos "Especial" en Bebidas.
      await crearProductoPorHttp(app, cliente, { nombre: 'Especial', categoriaId: bebidas.id });
      const special = await crearProductoPorHttp(app, cliente, {
        nombre: 'Especial',
        categoriaId: comidas.id,
      });

      await request(app.getHttpServer())
        .patch(`/api/products/${special.id}`)
        .set(...como(admin))
        .send({ categoriaId: bebidas.id })
        .expect(409);
    });

    it('edita nombre y descripcion sin tocar el resto', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/products/${producto.id}`)
        .set(...como(admin))
        .send({ nombre: 'Cafe de olla', descripcion: 'Nuevo' })
        .expect(200);

      const cuerpo = respuesta.body as ProductoE2E;
      expect(cuerpo.nombre).toBe('Cafe de olla');
      expect(cuerpo.descripcion).toBe('Nuevo');
      expect(cuerpo.categoriaId).toBe(categoria.id);
    });

    it('devuelve 409 al borrar un producto con precios', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });
      const gerente = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');

      await fijarOferta(app, gerente.token, {
        sucursalId: sucursales.norte,
        productoId: producto.id,
        varianteId: variantes.unica,
        precio: 2,
      }).expect(200);

      await request(app.getHttpServer())
        .delete(`/api/products/${producto.id}`)
        .set(...como(admin))
        .expect(409);
    });

    it('borra un producto sin precios', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });

      await request(app.getHttpServer())
        .delete(`/api/products/${producto.id}`)
        .set(...como(admin))
        .expect(204);
    });
  });

  describe('GET /products: listado, paginado y filtros', () => {
    it('devuelve el envoltorio de paginado', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      for (const nombre of ['Cafe', 'Jugo', 'Té']) {
        await crearProductoPorHttp(app, cliente, { nombre, categoriaId: categoria.id });
      }

      const respuesta = await request(app.getHttpServer())
        .get('/api/products')
        .set(...como(admin))
        .expect(200);

      const cuerpo = respuesta.body as ListadoProductosE2E;
      expect(cuerpo.total).toBe(3);
      expect(cuerpo.page).toBe(1);
      expect(cuerpo.limit).toBe(20);
      expect(cuerpo.totalPaginas).toBe(1);
      expect(cuerpo.data).toHaveLength(3);
    });

    it('pagina y respeta el limite pedido', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      for (const nombre of ['A', 'AA', 'AAA', 'AAAA', 'AAAAA']) {
        await crearProductoPorHttp(app, cliente, {
          nombre: `Prod ${nombre}`,
          categoriaId: categoria.id,
        });
      }

      const respuesta = await request(app.getHttpServer())
        .get('/api/products?page=2&limit=2')
        .set(...como(admin))
        .expect(200);

      const cuerpo = respuesta.body as ListadoProductosE2E;
      expect(cuerpo.data).toHaveLength(2);
      expect(cuerpo.total).toBe(5);
      expect(cuerpo.totalPaginas).toBe(3);
    });

    it('filtra por categoria', async () => {
      const cliente = { token: admin };
      const bebidas = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const comidas = await crearCategoriaPorHttp(app, cliente, 'Comidas');
      await crearProductoPorHttp(app, cliente, { nombre: 'Cafe', categoriaId: bebidas.id });
      await crearProductoPorHttp(app, cliente, { nombre: 'Torta', categoriaId: comidas.id });

      const respuesta = await request(app.getHttpServer())
        .get(`/api/products?categoriaId=${comidas.id}`)
        .set(...como(admin))
        .expect(200);

      const cuerpo = respuesta.body as ListadoProductosE2E;
      expect(cuerpo.total).toBe(1);
      expect(cuerpo.data[0].nombre).toBe('Torta');
    });

    it('busca por nombre ignorando mayusculas', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      await crearProductoPorHttp(app, cliente, { nombre: 'Cafe', categoriaId: categoria.id });
      await crearProductoPorHttp(app, cliente, { nombre: 'Torta', categoriaId: categoria.id });

      const respuesta = await request(app.getHttpServer())
        .get('/api/products?q=caf')
        .set(...como(admin))
        .expect(200);

      const cuerpo = respuesta.body as ListadoProductosE2E;
      expect(cuerpo.total).toBe(1);
      expect(cuerpo.data[0].nombre).toBe('Cafe');
    });

    it('devuelve 400 con un page o limit invalido', async () => {
      await request(app.getHttpServer())
        .get('/api/products?page=0')
        .set(...como(admin))
        .expect(400);
      await request(app.getHttpServer())
        .get('/api/products?limit=abc')
        .set(...como(admin))
        .expect(400);
    });
  });

  // ------------------------------------------------------------- carta y precios

  describe('PUT precio: permiso y alcance', () => {
    it('el Gerente fija un precio en su propia sucursal', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });

      const respuesta = await fijarOferta(app, admin, {
        sucursalId: sucursales.norte,
        productoId: producto.id,
        varianteId: variantes.unica,
        precio: 2.5,
      });

      // El admin no tiene `productos.precio.editar`: el guard le responde 403
      // antes de la regla de alcance.
      expect(respuesta.status).toBe(403);

      const gerente = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');
      const ok = await fijarOferta(app, gerente.token, {
        sucursalId: sucursales.norte,
        productoId: producto.id,
        varianteId: variantes.unica,
        precio: 2.5,
      }).expect(200);

      expect((ok.body as OfertaE2E).precio).toBe('2.50');
      expect((ok.body as OfertaE2E).estado).toBe('activo');
    });

    it('el Gerente no puede fijar precios en otra sucursal: 404', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });
      const gerente = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');

      await fijarOferta(app, gerente.token, {
        sucursalId: sucursales.sur,
        productoId: producto.id,
        varianteId: variantes.unica,
        precio: 2.5,
      }).expect(404);
    });

    it('el Empleado no puede fijar precios: 403', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });
      const token = await tokenDeEmpleado(app, admin, sucursales.norte, 'Empleado Norte');

      await fijarOferta(app, token, {
        sucursalId: sucursales.norte,
        productoId: producto.id,
        varianteId: variantes.unica,
        precio: 2.5,
      }).expect(403);
    });

    it('el segundo PUT actualiza en vez de duplicar', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });
      const gerente = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');

      const base = {
        sucursalId: sucursales.norte,
        productoId: producto.id,
        varianteId: variantes.unica,
      };

      await fijarOferta(app, gerente.token, { ...base, precio: 2.5 }).expect(200);
      const segunda = await fijarOferta(app, gerente.token, {
        ...base,
        precio: 3.75,
        estado: 'inactivo',
      }).expect(200);

      expect((segunda.body as OfertaE2E).precio).toBe('3.75');
      expect((segunda.body as OfertaE2E).estado).toBe('inactivo');

      const carta = await leerCarta(app, gerente.token, sucursales.norte).expect(200);
      expect(carta.body).toHaveLength(1);
    });

    it('valida el precio con 400 y no con 500', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });
      const gerente = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');

      const base = {
        sucursalId: sucursales.norte,
        productoId: producto.id,
        varianteId: variantes.unica,
      };

      await fijarOferta(app, gerente.token, { ...base, precio: 0 }).expect(400);
      await fijarOferta(app, gerente.token, { ...base, precio: -5 }).expect(400);
      await fijarOferta(app, gerente.token, { ...base, precio: 100000.01 }).expect(400);
      await fijarOferta(app, gerente.token, { ...base, precio: 1.234 }).expect(400);
      await fijarOferta(app, gerente.token, { ...base, precio: 'mucho' }).expect(400);
    });

    it('un precio en notacion exponencial responde 400, no revienta con 500', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });
      const gerente = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');

      // El cuerpo va escrito a mano para que el servidor reciba un numero real en
      // notacion exponencial. La opcion `maxDecimalPlaces` de class-validator
      // revienta con un TypeError en este caso (500); el validador propio lo
      // trata y responde 400.
      const respuesta = await fijarOfertaConJsonLiteral(
        app,
        gerente.token,
        {
          sucursalId: sucursales.norte,
          productoId: producto.id,
          varianteId: variantes.unica,
        },
        '{"precio":1e-7}',
      );

      expect(respuesta.status).toBe(400);
    });

    it('un precio con texto no numerico responde 400', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });
      const gerente = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');

      await fijarOferta(app, gerente.token, {
        sucursalId: sucursales.norte,
        productoId: producto.id,
        varianteId: variantes.unica,
        precio: 'mucho',
      }).expect(400);
    });

    it('acepta los extremos del rango', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });
      const gerente = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');

      const base = {
        sucursalId: sucursales.norte,
        productoId: producto.id,
        varianteId: variantes.unica,
      };

      const minimo = await fijarOferta(app, gerente.token, { ...base, precio: 0.01 }).expect(200);
      expect((minimo.body as OfertaE2E).precio).toBe('0.01');

      const maximo = await fijarOferta(app, gerente.token, {
        ...base,
        varianteId: variantes.grande,
        precio: 100000,
      }).expect(200);
      expect((maximo.body as OfertaE2E).precio).toBe('100000.00');
    });

    it('rechaza un estado desconocido con 400', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });
      const gerente = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');

      await fijarOferta(app, gerente.token, {
        sucursalId: sucursales.norte,
        productoId: producto.id,
        varianteId: variantes.unica,
        precio: 2,
        estado: 'agotado',
      }).expect(400);
    });

    it('da 404 si el producto o la variante no existen', async () => {
      const gerente = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');
      const idFantasma = '11111111-1111-4111-8111-111111111111';

      await fijarOferta(app, gerente.token, {
        sucursalId: sucursales.norte,
        productoId: idFantasma,
        varianteId: variantes.unica,
        precio: 2,
      }).expect(404);

      await fijarOferta(app, gerente.token, {
        sucursalId: sucursales.norte,
        productoId: idFantasma,
        varianteId: idFantasma,
        precio: 2,
      }).expect(404);
    });
  });

  describe('GET carta: visibilidad por rol', () => {
    /**
     * Arma una sucursal norte con un producto, una oferta activa y otra inactiva,
     * y devuelve el token del Gerente que las fijo.
     *
     * Devuelve el token en vez de crear cada uno su propio Gerente: el email se
     * deriva del nombre, y dos Gerentes llamados igual en la misma prueba
     * chocarían con el 409 de email duplicado.
     */
    async function montarEscenario(): Promise<{ tokenGerente: string; producto: ProductoE2E }> {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });
      const { token } = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');

      await fijarOferta(app, token, {
        sucursalId: sucursales.norte,
        productoId: producto.id,
        varianteId: variantes.unica,
        precio: 2.5,
      }).expect(200);

      await fijarOferta(app, token, {
        sucursalId: sucursales.norte,
        productoId: producto.id,
        varianteId: variantes.chico,
        precio: 3,
        estado: 'inactivo',
      }).expect(200);

      return { tokenGerente: token, producto };
    }

    it('el Gerente ve la oferta activa y la inactiva de su sucursal', async () => {
      const { tokenGerente } = await montarEscenario();

      const respuesta = await leerCarta(app, tokenGerente, sucursales.norte).expect(200);
      const filas = respuesta.body as CartaFilaE2E[];

      expect(filas).toHaveLength(2);
      expect(filas.map((f) => f.precio).sort()).toEqual(['2.50', '3.00']);
    });

    it('el Empleado solo ve lo activo', async () => {
      await montarEscenario();
      const token = await tokenDeEmpleado(app, admin, sucursales.norte, 'Empleado Norte');

      const respuesta = await leerCarta(app, token, sucursales.norte).expect(200);
      const filas = respuesta.body as CartaFilaE2E[];

      expect(filas).toHaveLength(1);
      expect(filas[0].estado).toBe('activo');
    });

    it('el Empleado no puede esquivar su filtro con ?estado=inactivo', async () => {
      await montarEscenario();
      const token = await tokenDeEmpleado(app, admin, sucursales.norte, 'Empleado Norte');

      const respuesta = await request(app.getHttpServer())
        .get(`/api/branches/${sucursales.norte}/products?estado=inactivo`)
        .set(...como(token))
        .expect(200);

      // El filtro del Empleado no se salta su restriccion: la interseccion queda
      // vacia y la carta no devuelve filas.
      expect(respuesta.body as CartaFilaE2E[]).toHaveLength(0);
    });

    it('el Gerente si puede filtrar por inactivo', async () => {
      const { tokenGerente } = await montarEscenario();

      const respuesta = await request(app.getHttpServer())
        .get(`/api/branches/${sucursales.norte}/products?estado=inactivo`)
        .set(...como(tokenGerente))
        .expect(200);

      const filas = respuesta.body as CartaFilaE2E[];
      expect(filas).toHaveLength(1);
      expect(filas[0].estado).toBe('inactivo');
    });

    it('rechaza un filtro de estado desconocido con 400', async () => {
      const gerente = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');

      await request(app.getHttpServer())
        .get(`/api/branches/${sucursales.norte}/products?estado=agotado`)
        .set(...como(gerente.token))
        .expect(400);
    });

    it('el Admin lee la carta de cualquier sucursal', async () => {
      await montarEscenario();

      const respuesta = await leerCarta(app, admin, sucursales.norte).expect(200);
      expect((respuesta.body as CartaFilaE2E[]).length).toBe(2);
    });

    it('el Gerente no lee la carta de otra sucursal: 404', async () => {
      const gerente = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');

      await leerCarta(app, gerente.token, sucursales.sur).expect(404);
    });

    it('el Empleado no lee la carta de otra sucursal: 404', async () => {
      const token = await tokenDeEmpleado(app, admin, sucursales.norte, 'Empleado Norte');

      await leerCarta(app, token, sucursales.sur).expect(404);
    });

    it('el Admin recibe 404 al leer una sucursal inexistente', async () => {
      await leerCarta(app, admin, '11111111-1111-4111-8111-111111111111').expect(404);
    });

    it('la carta trae producto, categoria, variante, precio como texto y estado', async () => {
      const { producto, tokenGerente } = await montarEscenario();

      const respuesta = await leerCarta(app, tokenGerente, sucursales.norte).expect(200);
      const fila = (respuesta.body as CartaFilaE2E[]).find(
        (f) => f.precio === '2.50',
      ) as CartaFilaE2E;

      expect(fila.producto.id).toBe(producto.id);
      expect(fila.producto.nombre).toBe('Cafe');
      expect(fila.producto.categoria.nombre).toBe('Bebidas');
      expect(fila.variante.nombre).toBe(NOMBRE_VARIANTE_BASE);
      expect(typeof fila.precio).toBe('string');
      expect(fila.precio).toMatch(/^\d+\.\d{2}$/u);
      expect(fila.estado).toBe('activo');
    });

    it('desactivar retira el producto de la carta del Empleado pero no de la del Gerente', async () => {
      const cliente = { token: admin };
      const categoria = await crearCategoriaPorHttp(app, cliente, 'Bebidas');
      const producto = await crearProductoPorHttp(app, cliente, {
        nombre: 'Cafe',
        categoriaId: categoria.id,
      });
      const gerente = await crearGerente(app, admin, sucursales.norte, 'Gerente Norte');

      await fijarOferta(app, gerente.token, {
        sucursalId: sucursales.norte,
        productoId: producto.id,
        varianteId: variantes.unica,
        precio: 2.5,
      }).expect(200);

      await fijarOferta(app, gerente.token, {
        sucursalId: sucursales.norte,
        productoId: producto.id,
        varianteId: variantes.unica,
        precio: 2.5,
        estado: 'inactivo',
      }).expect(200);

      const token = await tokenDeEmpleado(app, admin, sucursales.norte, 'Empleado Norte');

      expect((await leerCarta(app, token, sucursales.norte).expect(200)).body).toHaveLength(0);
      expect(
        (await leerCarta(app, gerente.token, sucursales.norte).expect(200)).body,
      ).toHaveLength(1);
    });
  });
});
