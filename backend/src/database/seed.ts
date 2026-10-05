// Seed idempotente de la base de datos: roles, permisos, sucursales, variantes
// y el usuario administrador inicial. Puede ejecutarse varias veces sin
// duplicar datos.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';

const RONDAS_BCRYPT = 12;
const LONGITUD_MINIMA_PASSWORD = 12;
const NOMBRE_ROL_ADMIN = 'Admin';

const SUCURSALES = [
  {
    nombre: 'Sucursal Centro',
    direccion: 'Av. Ficticia 100, Centro',
    telefono: '+51 900 000 001',
  },
  {
    nombre: 'Sucursal Norte',
    direccion: 'Av. Ficticia 200, Norte',
    telefono: '+51 900 000 002',
  },
  {
    nombre: 'Sucursal Sur',
    direccion: 'Av. Ficticia 300, Sur',
    telefono: '+51 900 000 003',
  },
];

const VARIANTES = ['Única', 'Chico', 'Mediano', 'Grande'];

const ROLES = ['Admin', 'Gerente', 'Empleado'] as const;

type NombreRol = (typeof ROLES)[number];

const PERMISOS: { codigo: string; descripcion: string; roles: NombreRol[] }[] = [
  { codigo: 'sucursales.crear_editar', descripcion: 'Crear y editar sucursales', roles: ['Admin'] },
  { codigo: 'sucursales.ver', descripcion: 'Ver sucursales', roles: ['Admin', 'Gerente', 'Empleado'] },
  { codigo: 'usuarios.crear_editar', descripcion: 'Crear y editar usuarios', roles: ['Admin', 'Gerente'] },
  { codigo: 'permisos.asignar', descripcion: 'Asignar y revocar permisos de usuarios', roles: ['Admin', 'Gerente'] },
  { codigo: 'productos.catalogo.editar', descripcion: 'Editar el catalogo de productos', roles: ['Admin'] },
  { codigo: 'productos.precio.editar', descripcion: 'Editar precios de productos por sucursal', roles: ['Gerente'] },
  { codigo: 'productos.ver', descripcion: 'Ver productos', roles: ['Admin', 'Gerente', 'Empleado'] },
  { codigo: 'insumos.catalogo.editar', descripcion: 'Editar el catalogo de insumos', roles: ['Admin'] },
  { codigo: 'insumos.ver', descripcion: 'Ver insumos', roles: ['Admin', 'Gerente'] },
  { codigo: 'inventario.registrar', descripcion: 'Registrar movimientos de inventario', roles: ['Admin', 'Gerente'] },
  { codigo: 'inventario.minimo.editar', descripcion: 'Editar el stock minimo de los insumos', roles: ['Admin', 'Gerente'] },
  { codigo: 'inventario.recuento', descripcion: 'Registrar recuentos de inventario', roles: ['Admin', 'Gerente'] },
  { codigo: 'alertas.ver_resolver', descripcion: 'Ver y resolver alertas de stock', roles: ['Admin', 'Gerente'] },
  { codigo: 'ventas.registrar', descripcion: 'Registrar ventas', roles: ['Gerente'] },
  { codigo: 'ventas.anular', descripcion: 'Anular ventas del dia', roles: ['Gerente', 'Empleado'] },
  { codigo: 'ventas.ver', descripcion: 'Ver ventas', roles: ['Admin', 'Gerente'] },
  { codigo: 'reportes.comparativos.ver', descripcion: 'Ver reportes comparativos entre sucursales', roles: ['Admin'] },
  { codigo: 'empleados.crear_editar', descripcion: 'Crear y editar empleados', roles: ['Admin', 'Gerente'] },
  { codigo: 'turnos.editar', descripcion: 'Editar turnos y asignaciones', roles: ['Admin', 'Gerente'] },
  { codigo: 'asistencia.marcar', descripcion: 'Marcar entradas y salidas', roles: ['Admin', 'Gerente', 'Empleado'] },
  { codigo: 'asistencia.corregir', descripcion: 'Corregir registros de asistencia', roles: ['Gerente'] },
  { codigo: 'asistencia.ver', descripcion: 'Ver registros de asistencia', roles: ['Admin', 'Gerente', 'Empleado'] },
  { codigo: 'equipo.registrar_editar', descripcion: 'Registrar y editar equipos', roles: ['Admin', 'Gerente'] },
  { codigo: 'equipo.ver', descripcion: 'Ver equipos y su historial', roles: ['Admin', 'Gerente'] },
];

type Db = Prisma.TransactionClient;

export type Contadores = Record<string, { creados: number; existentes: number }>;

/** Credenciales del administrador inicial. Las pasa quien invoca el seed. */
export type CredencialesAdmin = { email: string; password: string };

function anotar(contadores: Contadores, entidad: string, estado: 'creado' | 'existente'): void {
  const actual = contadores[entidad] ?? { creados: 0, existentes: 0 };
  if (estado === 'creado') {
    actual.creados += 1;
  } else {
    actual.existentes += 1;
  }
  contadores[entidad] = actual;
}

/** Evita casts: si falta una clave es un fallo interno, no un undefined silencioso. */
function idDe(mapa: Map<string, string>, clave: string, origen: string): string {
  const valor = mapa.get(clave);
  if (valor === undefined) {
    throw new Error(`Error interno del seed: no se resolvio "${clave}" (${origen}).`);
  }
  return valor;
}

/** Oculta secretos por si un error del driver los incluye en el mensaje. */
function redactar(mensaje: string): string {
  let salida = mensaje;
  for (const nombre of ['DATABASE_URL', 'SEED_ADMIN_PASSWORD']) {
    const valor = process.env[nombre];
    if (valor) {
      salida = salida.split(valor).join(`[${nombre} redactado]`);
    }
  }
  return salida;
}

/**
 * Lee y valida las credenciales del administrador inicial.
 * Falla sin mostrar ningun valor: solo el nombre de la variable y el motivo.
 */
function leerCredencialesAdmin(): { email: string; password: string } {
  const email = (process.env.SEED_ADMIN_EMAIL ?? '').trim();
  // La contrasena no se recorta: es parte del valor real elegido por el usuario.
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';
  const problemas: string[] = [];

  if (!email) {
    problemas.push('SEED_ADMIN_EMAIL no esta definida en backend/.env');
  } else if (!email.includes('@')) {
    problemas.push('SEED_ADMIN_EMAIL no tiene formato de correo electronico');
  }

  if (!password) {
    problemas.push('SEED_ADMIN_PASSWORD no esta definida en backend/.env');
  } else if (password.length < LONGITUD_MINIMA_PASSWORD) {
    problemas.push(
      `SEED_ADMIN_PASSWORD debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres (tiene ${password.length})`,
    );
  }

  if (problemas.length > 0) {
    throw new Error(
      `No se puede crear el usuario administrador:\n${problemas.map((p) => `  - ${p}`).join('\n')}` +
        '\nDefine ambas variables en backend/.env (plantilla en backend/.env.example).' +
        '\nPor seguridad no se muestran sus valores.',
    );
  }

  return { email, password };
}

async function asegurarRoles(db: Db, contadores: Contadores): Promise<Map<NombreRol, string>> {
  const ids = new Map<NombreRol, string>();

  for (const nombre of ROLES) {
    const existente = await db.rol.findUnique({ where: { nombre }, select: { id: true } });
    if (existente) {
      anotar(contadores, 'roles', 'existente');
      ids.set(nombre, existente.id);
      continue;
    }
    const creado = await db.rol.create({ data: { nombre }, select: { id: true } });
    anotar(contadores, 'roles', 'creado');
    ids.set(nombre, creado.id);
  }

  return ids;
}

async function asegurarPermisos(
  db: Db,
  contadores: Contadores,
  idsRol: Map<NombreRol, string>,
): Promise<void> {
  const idsPermiso = new Map<string, string>();

  for (const permiso of PERMISOS) {
    const existente = await db.permiso.findUnique({
      where: { codigo: permiso.codigo },
      select: { id: true },
    });
    if (existente) {
      anotar(contadores, 'permisos', 'existente');
      idsPermiso.set(permiso.codigo, existente.id);
      continue;
    }
    const creado = await db.permiso.create({
      data: { codigo: permiso.codigo, descripcion: permiso.descripcion },
      select: { id: true },
    });
    anotar(contadores, 'permisos', 'creado');
    idsPermiso.set(permiso.codigo, creado.id);
  }

  const asignaciones = PERMISOS.flatMap((permiso) =>
    permiso.roles.map((rol) => ({
      rolId: idDe(idsRol, rol, 'roles'),
      permisoId: idDe(idsPermiso, permiso.codigo, 'permisos'),
    })),
  );

  // skipDuplicates mantiene la idempotencia sobre el @@id [rolId, permisoId].
  const { count } = await db.rolPermiso.createMany({ data: asignaciones, skipDuplicates: true });
  contadores['roles_permisos'] = {
    creados: count,
    existentes: asignaciones.length - count,
  };
}

async function asegurarSucursales(db: Db, contadores: Contadores): Promise<void> {
  for (const sucursal of SUCURSALES) {
    const existente = await db.sucursal.findUnique({
      where: { nombre: sucursal.nombre },
      select: { id: true },
    });
    if (existente) {
      anotar(contadores, 'sucursales', 'existente');
      continue;
    }
    await db.sucursal.create({ data: sucursal });
    anotar(contadores, 'sucursales', 'creado');
  }
}

async function asegurarVariantes(db: Db, contadores: Contadores): Promise<void> {
  for (const nombre of VARIANTES) {
    const existente = await db.variante.findUnique({ where: { nombre }, select: { id: true } });
    if (existente) {
      anotar(contadores, 'variantes', 'existente');
      continue;
    }
    await db.variante.create({ data: { nombre } });
    anotar(contadores, 'variantes', 'creado');
  }
}

/** Si el administrador ya existe no se toca su contrasena. */
async function asegurarAdmin(
  db: Db,
  contadores: Contadores,
  idRolAdmin: string,
  email: string,
  password: string,
): Promise<void> {
  const existente = await db.usuario.findUnique({ where: { email }, select: { id: true } });
  if (existente) {
    anotar(contadores, 'usuarios', 'existente');
    return;
  }

  const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);
  await db.usuario.create({
    data: {
      nombre: 'Administrador',
      email,
      passwordHash,
      rolId: idRolAdmin,
      sucursalId: null,
      estado: 'activo',
    },
  });
  anotar(contadores, 'usuarios', 'creado');
}

function imprimirResumen(contadores: Contadores): void {
  console.log('\nSeed finalizado.');
  let creados = 0;
  let existentes = 0;

  for (const [entidad, valores] of Object.entries(contadores)) {
    console.log(`  ${entidad.padEnd(15)} ${valores.creados} creados, ${valores.existentes} ya existian`);
    creados += valores.creados;
    existentes += valores.existentes;
  }

  console.log(`  ${'TOTAL'.padEnd(15)} ${creados} creados, ${existentes} ya existian`);
}

function crearCliente(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'Falta la variable de entorno DATABASE_URL. Definela en backend/.env (plantilla en backend/.env.example).',
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

async function ejecutar(): Promise<void> {
  const prisma = crearCliente();

  try {
    const { email, password } = leerCredencialesAdmin();
    const contadores = await ejecutarSeed(prisma, { email, password });

    imprimirResumen(contadores);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error(`\nSeed fallido: ${redactar(mensaje)}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Nucleo del seed, reutilizable.
 *
 * Se exporta para que las pruebas end-to-end puedan sembrar la base de prueba
 * pasando su propio cliente de Prisma y sus propias credenciales de
 * administrador, sin depender de las variables de entorno ni de tener que
 * duplicar la definicion de roles, permisos y sucursales.
 *
 * Es idempotente y NO imprime nada: la salida por consola es responsabilidad
 * del comando de CLI, para que quien la use pueda decidir como informar.
 */
export async function ejecutarSeed(
  prisma: PrismaClient,
  credenciales: CredencialesAdmin,
): Promise<Contadores> {
  return prisma.$transaction<Contadores>(async (tx) => {
    const resumen: Contadores = {};

    await asegurarSucursales(tx, resumen);
    await asegurarVariantes(tx, resumen);
    const idsRol = await asegurarRoles(tx, resumen);
    await asegurarPermisos(tx, resumen, idsRol);
    await asegurarAdmin(
      tx,
      resumen,
      idDe(idsRol, NOMBRE_ROL_ADMIN, 'roles'),
      credenciales.email,
      credenciales.password,
    );

    return resumen;
  });
}

// Solo se ejecuta el seed cuando este archivo es el programa principal. Asi las
// pruebas pueden importar `ejecutarSeed` sin que se dispare el seed como efecto
// secundario al cargar el modulo.
if (require.main === module) {
  void ejecutar();
}