// Seed de DEMOSTRACION para desarrollo.
//
// Carga un escenario de negocio completo (dos sucursales, usuarios con roles,
// catalogo, inventario, personal, actividad de ventas y asistencia, y equipos)
// reutilizando los MISMOS casos de uso que la API. No inserta filas a mano
// salvo donde no hay otra via:
//
//   * Reubicacion temporal de las ventas: `RegistrarVentaUseCase` sella la hora
//     con `now()` de la base y no la acepta por parametro, asi que despues de
//     registrar se ajusta `venta.createdAt` y `venta_detalle.createdAt` con
//     Prisma para repartir la actividad en los ultimos dias.
//   * PIN de los empleados: el alta genera un PIN aleatorio; aqui se fija un PIN
//     fijo de demostracion con `EmployeesRepository.guardarPinHash`.
//
// Es idempotente: una segunda ejecucion no duplica nada. Para los datos sin
// clave natural (ventas, asistencia) se comprueba por el vendedor/empleado y se
// omite el bloque entero si ya existe.
//
// REQUIERE que el seed real ya se haya ejecutado (`npm run db:seed`): reutiliza
// sus sucursales y variantes base y necesita un Admin activo para crear el
// resto sin saltarse las reglas de la aplicacion.
import 'dotenv/config';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import bcrypt from 'bcryptjs';
import { AppModule } from '../app.module';
import { PrismaService } from './prisma.service';
import { asegurarEntornoDemo, leerPasswordDemo } from './seed-demo-ambiente';
import type { Contadores } from './seed';
import {
  ROL_ADMIN,
  ROL_EMPLEADO,
  ROL_GERENTE,
} from '../modules/users/domain/roles';
import {
  CrearUsuarioUseCase,
  RONDAS_BCRYPT,
} from '../modules/users/application/use-cases/crear-usuario.use-case';
import { BranchesRepository } from '../modules/branches/branches.repository';
import { CategoriasService } from '../modules/products/categorias.service';
import { ProductosService } from '../modules/products/productos.service';
import { OfertasService } from '../modules/products/ofertas.service';
import { ProductsRepository } from '../modules/products/products.repository';
import {
  mismoNombre,
  type EstadoOferta,
} from '../modules/products/products.rules';
import { CrearInsumoUseCase } from '../modules/inventory/application/use-cases/crear-insumo.use-case';
import { ConfigurarStockUseCase } from '../modules/inventory/application/use-cases/configurar-stock.use-case';
import { RegistrarEntradaUseCase } from '../modules/inventory/application/use-cases/registrar-entrada.use-case';
import { InventoryRepository } from '../modules/inventory/infrastructure/inventory.repository';
import type { PresentacionInsumo } from '../modules/inventory/domain/rules/presentacion-insumo';
import { CrearEmpleadoUseCase } from '../modules/employees/application/use-cases/crear-empleado.use-case';
import { EmployeesRepository } from '../modules/employees/infrastructure/employees.repository';
import { CrearTurnoUseCase } from '../modules/shifts/application/use-cases/crear-turno.use-case';
import { CrearAsignacionUseCase } from '../modules/shifts/application/use-cases/crear-asignacion.use-case';
import { ShiftsRepository } from '../modules/shifts/infrastructure/shifts.repository';
import type { TurnoRespuesta } from '../modules/shifts/infrastructure/shifts.repository';
import { RegistrarVentaUseCase } from '../modules/sales/application/use-cases/registrar-venta.use-case';
import { AnularVentaUseCase } from '../modules/sales/application/use-cases/anular-venta.use-case';
import { MarcarAsistenciaUseCase } from '../modules/attendance/application/use-cases/marcar-asistencia.use-case';
import { AttendanceRepository } from '../modules/attendance/infrastructure/attendance.repository';
import { EquipmentService } from '../modules/equipment/equipment.service';
import { EquipmentRepository } from '../modules/equipment/equipment.repository';
import type { EstadoEquipo } from '../modules/equipment/domain/rules/equipment.rules';

// ---------------------------------------------------------------------------
// Escenario de demostracion (datos fijos y deterministas)
// ---------------------------------------------------------------------------

/** PIN fijo de los empleados demo. Solo para desarrollo. */
const PIN_DEMO = '246810';

const SUCURSAL_CENTRO = 'Sucursal Centro';
const SUCURSAL_NORTE = 'Sucursal Norte';
const SUCURSALES_DEMO = [SUCURSAL_CENTRO, SUCURSAL_NORTE];

const VARIANTE_UNICA = 'Única';
const VARIANTE_CHICO = 'Chico';
const VARIANTE_MEDIANO = 'Mediano';
const VARIANTE_GRANDE = 'Grande';
const VARIANTES_BASE = [
  VARIANTE_UNICA,
  VARIANTE_CHICO,
  VARIANTE_MEDIANO,
  VARIANTE_GRANDE,
];

const USUARIOS_DEMO = [
  {
    nombreUsuario: 'gerente.centro',
    nombre: 'Gerente Centro',
    rol: ROL_GERENTE,
    sucursal: SUCURSAL_CENTRO,
  },
  {
    nombreUsuario: 'empleado.centro',
    nombre: 'Empleado Centro',
    rol: ROL_EMPLEADO,
    sucursal: SUCURSAL_CENTRO,
  },
  {
    nombreUsuario: 'gerente.norte',
    nombre: 'Gerente Norte',
    rol: ROL_GERENTE,
    sucursal: SUCURSAL_NORTE,
  },
  {
    nombreUsuario: 'empleado.norte',
    nombre: 'Empleado Norte',
    rol: ROL_EMPLEADO,
    sucursal: SUCURSAL_NORTE,
  },
] as const;

const CATEGORIAS_DEMO = ['Bebidas calientes', 'Bebidas frías', 'Panadería'];

type ProductoDemo = {
  nombre: string;
  categoria: string;
  descripcion: string;
  precios: { variante: string; precio: number }[];
};

const PRODUCTOS_DEMO: ProductoDemo[] = [
  {
    nombre: 'Café Americano',
    categoria: 'Bebidas calientes',
    descripcion: 'Café negro pasado por agua caliente.',
    precios: [
      { variante: VARIANTE_CHICO, precio: 6 },
      { variante: VARIANTE_MEDIANO, precio: 8 },
      { variante: VARIANTE_GRANDE, precio: 10 },
    ],
  },
  {
    nombre: 'Capuchino',
    categoria: 'Bebidas calientes',
    descripcion: 'Café espresso con leche vaporizada y espuma.',
    precios: [
      { variante: VARIANTE_CHICO, precio: 8 },
      { variante: VARIANTE_MEDIANO, precio: 10 },
      { variante: VARIANTE_GRANDE, precio: 12 },
    ],
  },
  {
    nombre: 'Chocolate Caliente',
    categoria: 'Bebidas calientes',
    descripcion: 'Chocolate en polvo disuelto en leche caliente.',
    precios: [
      { variante: VARIANTE_CHICO, precio: 8 },
      { variante: VARIANTE_MEDIANO, precio: 10 },
      { variante: VARIANTE_GRANDE, precio: 12 },
    ],
  },
  {
    nombre: 'Té Verde',
    categoria: 'Bebidas calientes',
    descripcion: 'Infusión de hojas de té verde.',
    precios: [
      { variante: VARIANTE_CHICO, precio: 5 },
      { variante: VARIANTE_MEDIANO, precio: 7 },
      { variante: VARIANTE_GRANDE, precio: 9 },
    ],
  },
  {
    nombre: 'Jugo de Naranja',
    categoria: 'Bebidas frías',
    descripcion: 'Naranja recién exprimida.',
    precios: [
      { variante: VARIANTE_CHICO, precio: 7 },
      { variante: VARIANTE_MEDIANO, precio: 9 },
      { variante: VARIANTE_GRANDE, precio: 11 },
    ],
  },
  {
    nombre: 'Limonada Frozen',
    categoria: 'Bebidas frías',
    descripcion: 'Limonada batida con hielo.',
    precios: [
      { variante: VARIANTE_CHICO, precio: 8 },
      { variante: VARIANTE_MEDIANO, precio: 10 },
      { variante: VARIANTE_GRANDE, precio: 12 },
    ],
  },
  {
    nombre: 'Frappé de Mocha',
    categoria: 'Bebidas frías',
    descripcion: 'Café, chocolate y hielo licuados.',
    precios: [
      { variante: VARIANTE_CHICO, precio: 10 },
      { variante: VARIANTE_MEDIANO, precio: 12 },
      { variante: VARIANTE_GRANDE, precio: 14 },
    ],
  },
  {
    nombre: 'Agua de Jamaica',
    categoria: 'Bebidas frías',
    descripcion: 'Infusión fría de flor de jamaica.',
    precios: [
      { variante: VARIANTE_CHICO, precio: 5 },
      { variante: VARIANTE_MEDIANO, precio: 7 },
      { variante: VARIANTE_GRANDE, precio: 9 },
    ],
  },
  {
    nombre: 'Croissant de Mantequilla',
    categoria: 'Panadería',
    descripcion: 'Hojaldre de mantequilla horneado en el día.',
    precios: [{ variante: VARIANTE_UNICA, precio: 6 }],
  },
  {
    nombre: 'Muffin de Arándanos',
    categoria: 'Panadería',
    descripcion: 'Bizcocho individual con arándanos.',
    precios: [{ variante: VARIANTE_UNICA, precio: 7 }],
  },
  {
    nombre: 'Empanada de Carne',
    categoria: 'Panadería',
    descripcion: 'Empanada horneada rellena de carne.',
    precios: [{ variante: VARIANTE_UNICA, precio: 8 }],
  },
  {
    nombre: 'Galleta de Avena',
    categoria: 'Panadería',
    descripcion: 'Galleta de avena y pasas.',
    precios: [{ variante: VARIANTE_UNICA, precio: 4 }],
  },
];

/**
 * Oferta que se deja inactiva a proposito para poder probar el estado y el
 * 409/404 de la API al vender un producto retirado (Galleta de Avena en Norte).
 */
const OFERTA_INACTIVA = {
  producto: 'Galleta de Avena',
  variante: VARIANTE_UNICA,
  sucursal: SUCURSAL_NORTE,
};

type InsumoDemo = {
  nombre: string;
  presentacion: PresentacionInsumo;
  stockMinimo: number;
  cantidad: number;
};

/** El primer insumo queda por debajo del minimo para abrir una alerta. */
const INSUMOS_DEMO: InsumoDemo[] = [
  { nombre: 'Café en grano', presentacion: 'bolsa', stockMinimo: 20, cantidad: 5 },
  { nombre: 'Leche entera', presentacion: 'caja', stockMinimo: 10, cantidad: 40 },
  { nombre: 'Chocolate en polvo', presentacion: 'bolsa', stockMinimo: 8, cantidad: 30 },
  { nombre: 'Harina de trigo', presentacion: 'paquete', stockMinimo: 10, cantidad: 35 },
  { nombre: 'Azúcar rubia', presentacion: 'paquete', stockMinimo: 8, cantidad: 25 },
  { nombre: 'Mantequilla', presentacion: 'unidad', stockMinimo: 12, cantidad: 40 },
  { nombre: 'Huevos', presentacion: 'paquete_varias_unidades', stockMinimo: 6, cantidad: 24 },
  { nombre: 'Levadura seca', presentacion: 'paquete', stockMinimo: 5, cantidad: 18 },
  { nombre: 'Vasos de 12 oz', presentacion: 'paquete_varias_unidades', stockMinimo: 10, cantidad: 60 },
  { nombre: 'Servilletas', presentacion: 'paquete', stockMinimo: 8, cantidad: 32 },
];

const EMPLEADOS_DEMO = [
  { usuario: 'empleado.centro', cargo: 'Barista' },
  { usuario: 'empleado.norte', cargo: 'Atención al cliente' },
];

type TurnoDemo = {
  tipo: string;
  horaInicio?: string;
  horaFin?: string;
  diasSemana?: string;
};

const TURNOS_DEMO: TurnoDemo[] = [
  { tipo: 'fijo', horaInicio: '08:00', horaFin: '16:00', diasSemana: '1,2,3,4,5' },
  { tipo: 'fijo', horaInicio: '14:00', horaFin: '22:00', diasSemana: '1,2,3,4,5' },
  { tipo: 'variable' },
];

const EQUIPOS_DEMO: { nombre: string; tipo: string; estado: EstadoEquipo }[] = [
  { nombre: 'Cafetera espresso', tipo: 'Maquinaria', estado: 'funcionando' },
  { nombre: 'Refrigeradora', tipo: 'Refrigeración', estado: 'danado' },
  { nombre: 'Horno de panadería', tipo: 'Maquinaria', estado: 'en_mantenimiento' },
];

const NUM_VENTAS_DEMO = 15;

// ---------------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------------

type ActorDemo = {
  id: string;
  rol: string;
  sucursalId: string | null;
  permisosEfectivos: readonly string[];
};

/** Igual que en el seed real: cuenta creados y ya existentes por entidad. */
function anotar(
  contadores: Contadores,
  entidad: string,
  estado: 'creado' | 'existente',
): void {
  const actual = contadores[entidad] ?? { creados: 0, existentes: 0 };
  if (estado === 'creado') {
    actual.creados += 1;
  } else {
    actual.existentes += 1;
  }
  contadores[entidad] = actual;
}

/** Falla con un mensaje claro si falta un dato que deberia existir. */
function requerir<T>(valor: T | undefined | null, mensaje: string): T {
  if (valor === undefined || valor === null) {
    throw new Error(mensaje);
  }
  return valor;
}

function fechaIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function hoy(): string {
  return fechaIso(new Date());
}

function fechaHaceDias(dias: number): string {
  return fechaIso(new Date(Date.now() - dias * 24 * 60 * 60 * 1000));
}

type TurnoComparable = {
  tipo: string;
  horaInicio?: string | null;
  horaFin?: string | null;
  diasSemana?: string | null;
};

/** Clave natural de un turno para no duplicarlo al reejecutar. */
function mismoTurno(a: TurnoComparable, b: TurnoComparable): boolean {
  return (
    a.tipo === b.tipo &&
    (a.horaInicio ?? null) === (b.horaInicio ?? null) &&
    (a.horaFin ?? null) === (b.horaFin ?? null) &&
    (a.diasSemana ?? null) === (b.diasSemana ?? null)
  );
}

/** Oculta secretos por si un error del driver los incluye en el mensaje. */
function redactar(mensaje: string): string {
  let salida = mensaje;
  for (const nombre of ['DATABASE_URL', 'SEED_DEMO_PASSWORD']) {
    const valor = process.env[nombre];
    if (valor) {
      salida = salida.split(valor).join(`[${nombre} redactado]`);
    }
  }
  return salida;
}

function imprimirResumen(contadores: Contadores): void {
  console.log('\nSeed de demostracion finalizado.');
  let creados = 0;
  let existentes = 0;

  for (const [entidad, valores] of Object.entries(contadores)) {
    console.log(
      `  ${entidad.padEnd(20)} ${valores.creados} creados, ${valores.existentes} ya existian`,
    );
    creados += valores.creados;
    existentes += valores.existentes;
  }

  console.log(`  ${'TOTAL'.padEnd(20)} ${creados} creados, ${existentes} ya existian`);
}

// ---------------------------------------------------------------------------
// Nucleo del seed
// ---------------------------------------------------------------------------

async function ejecutarDemoSeed(
  app: INestApplicationContext,
  prisma: PrismaService,
  password: string,
): Promise<Contadores> {
  const contadores: Contadores = {};

  const branchesRepository = app.get(BranchesRepository);  const productsRepository = app.get(ProductsRepository);
  const inventoryRepository = app.get(InventoryRepository);
  const employeesRepository = app.get(EmployeesRepository);
  const shiftsRepository = app.get(ShiftsRepository);
  const attendanceRepository = app.get(AttendanceRepository);
  const equipmentRepository = app.get(EquipmentRepository);

  const crearUsuario = app.get(CrearUsuarioUseCase);
  const categoriasService = app.get(CategoriasService);
  const productosService = app.get(ProductosService);
  const ofertasService = app.get(OfertasService);
  const crearInsumo = app.get(CrearInsumoUseCase);
  const configurarStock = app.get(ConfigurarStockUseCase);
  const registrarEntrada = app.get(RegistrarEntradaUseCase);
  const crearEmpleado = app.get(CrearEmpleadoUseCase);
  const crearTurno = app.get(CrearTurnoUseCase);
  const crearAsignacion = app.get(CrearAsignacionUseCase);
  const registrarVenta = app.get(RegistrarVentaUseCase);
  const anularVenta = app.get(AnularVentaUseCase);
  const marcarAsistencia = app.get(MarcarAsistenciaUseCase);
  const equipmentService = app.get(EquipmentService);

  // --- Prerrequisito: datos base del seed real -----------------------------

  const admin = await prisma.usuario.findFirst({
    where: { estado: 'activo', rol: { nombre: ROL_ADMIN } },
    select: { id: true },
  });

  if (admin === null) {
    throw new Error(
      'No hay un usuario Admin activo. El seed de demostracion reutiliza el catalogo base ' +
        'y necesita un Admin para crear el resto; ejecuta primero "npm run db:seed".',
    );
  }

  const adminActor: ActorDemo = {
    id: admin.id,
    rol: ROL_ADMIN,
    sucursalId: null,
    permisosEfectivos: [],
  };

  const sucursales = await branchesRepository.listar();
  const sucursalesPorNombre = new Map(
    sucursales.map((sucursal) => [sucursal.nombre, sucursal.id]),
  );

  const idDeSucursal = (nombre: string): string =>
    requerir(
      sucursalesPorNombre.get(nombre),
      `Falta la sucursal "${nombre}" del seed base. Ejecuta primero "npm run db:seed".`,
    );

  for (const nombre of SUCURSALES_DEMO) {
    idDeSucursal(nombre);
  }

  const variantes = await productsRepository.listarVariantes();
  const variantesPorNombre = new Map(
    variantes.map((variante) => [variante.nombre, variante.id]),
  );

  for (const nombre of VARIANTES_BASE) {
    if (!variantes.some((variante) => mismoNombre(variante.nombre, nombre))) {
      throw new Error(
        `Falta la variante "${nombre}" del catalogo base. Ejecuta primero "npm run db:seed".`,
      );
    }
  }

  // --- Usuarios demo --------------------------------------------------------

  const usuariosDemo = new Map<string, { id: string; sucursalId: string | null }>();

  for (const spec of USUARIOS_DEMO) {
    const sucursalId = idDeSucursal(spec.sucursal);
    const existente = await prisma.usuario.findUnique({
      where: { nombreUsuario: spec.nombreUsuario },
      select: { id: true, sucursalId: true },
    });

    if (existente !== null) {
      anotar(contadores, 'usuarios_demo', 'existente');
      usuariosDemo.set(spec.nombreUsuario, existente);
      continue;
    }

    const creado = await crearUsuario.ejecutar(adminActor, {
      nombre: spec.nombre,
      nombreUsuario: spec.nombreUsuario,
      password,
      rol: spec.rol,
      sucursalId,
    });
    anotar(contadores, 'usuarios_demo', 'creado');
    usuariosDemo.set(spec.nombreUsuario, {
      id: creado.id,
      sucursalId: creado.sucursalId,
    });
  }

  const centroId = idDeSucursal(SUCURSAL_CENTRO);
  const norteId = idDeSucursal(SUCURSAL_NORTE);

  const actorGerente = (nombreUsuario: string, sucursalId: string): ActorDemo => {
    const usuario = requerir(
      usuariosDemo.get(nombreUsuario),
      `Error interno del seed demo: falta el usuario "${nombreUsuario}".`,
    );
    return {
      id: usuario.id,
      rol: ROL_GERENTE,
      sucursalId,
      permisosEfectivos: [],
    };
  };

  const gerenteCentro = actorGerente('gerente.centro', centroId);
  const gerenteNorte = actorGerente('gerente.norte', norteId);
  const gerenteDeSucursal = (sucursalId: string): ActorDemo =>
    sucursalId === centroId ? gerenteCentro : gerenteNorte;

  // --- Catalogo: categorias ------------------------------------------------

  const categoriaPorNombre = new Map<string, string>();
  const categoriasExistentes = await productsRepository.listarCategorias();

  for (const nombre of CATEGORIAS_DEMO) {
    const existente = categoriasExistentes.find((categoria) =>
      mismoNombre(categoria.nombre, nombre),
    );

    if (existente !== undefined) {
      anotar(contadores, 'categorias', 'existente');
      categoriaPorNombre.set(nombre, existente.id);
      continue;
    }

    const creada = await categoriasService.crear(adminActor.id, nombre);
    anotar(contadores, 'categorias', 'creado');
    categoriaPorNombre.set(nombre, creada.id);
  }

  // --- Catalogo: productos --------------------------------------------------

  const productoPorNombre = new Map<string, string>();

  for (const spec of PRODUCTOS_DEMO) {
    const categoriaId = requerir(
      categoriaPorNombre.get(spec.categoria),
      `Error interno del seed demo: falta la categoria "${spec.categoria}".`,
    );
    const existentes = await productsRepository.listarProductos({
      page: 1,
      limit: 100,
      categoriaId,
    });
    const existente = existentes.find((producto) =>
      mismoNombre(producto.nombre, spec.nombre),
    );

    if (existente !== undefined) {
      anotar(contadores, 'productos', 'existente');
      productoPorNombre.set(spec.nombre, existente.id);
      continue;
    }

    const creado = await productosService.crear(adminActor.id, {
      nombre: spec.nombre,
      categoriaId,
      descripcion: spec.descripcion,
    });
    anotar(contadores, 'productos', 'creado');
    productoPorNombre.set(spec.nombre, creado.id);
  }

  // --- Catalogo: ofertas por sucursal --------------------------------------

  for (const sucursalId of [centroId, norteId]) {
    const carta = await ofertasService.carta(adminActor, sucursalId);
    const ofertasExistentes = new Set(
      carta.map((fila) => `${fila.productoId}:${fila.varianteId}`),
    );

    for (const spec of PRODUCTOS_DEMO) {
      const productoId = requerir(
        productoPorNombre.get(spec.nombre),
        `Error interno del seed demo: falta el producto "${spec.nombre}".`,
      );

      for (const { variante, precio } of spec.precios) {
        const varianteId = requerir(
          variantesPorNombre.get(variante),
          `Error interno del seed demo: falta la variante "${variante}".`,
        );
        const clave = `${productoId}:${varianteId}`;

        if (ofertasExistentes.has(clave)) {
          anotar(contadores, 'ofertas', 'existente');
          continue;
        }

        const inactiva =
          spec.nombre === OFERTA_INACTIVA.producto &&
          variante === OFERTA_INACTIVA.variante &&
          sucursalId === norteId;
        const estado: EstadoOferta = inactiva ? 'inactivo' : 'activo';

        await ofertasService.upsert(gerenteDeSucursal(sucursalId), {
          sucursalId,
          productoId,
          varianteId,
          precio,
          estado,
        });
        anotar(contadores, 'ofertas', 'creado');
      }
    }
  }

  // --- Inventario: insumos y stock -----------------------------------------

  const insumoPorNombre = new Map<string, string>();
  const insumosExistentes = await inventoryRepository.listarInsumos({
    page: 1,
    limit: 100,
  });

  for (const spec of INSUMOS_DEMO) {
    const existente = insumosExistentes.find((insumo) =>
      mismoNombre(insumo.nombre, spec.nombre),
    );

    if (existente !== undefined) {
      anotar(contadores, 'insumos', 'existente');
      insumoPorNombre.set(spec.nombre, existente.id);
      continue;
    }

    const creado = await crearInsumo.ejecutar(adminActor.id, {
      nombre: spec.nombre,
      presentacion: spec.presentacion,
    });
    anotar(contadores, 'insumos', 'creado');
    insumoPorNombre.set(spec.nombre, creado.id);
  }

  for (const sucursalId of [centroId, norteId]) {
    for (const spec of INSUMOS_DEMO) {
      const insumoId = requerir(
        insumoPorNombre.get(spec.nombre),
        `Error interno del seed demo: falta el insumo "${spec.nombre}".`,
      );
      const stock = await inventoryRepository.buscarStock(insumoId, sucursalId);

      if (stock !== null) {
        anotar(contadores, 'stock_insumos', 'existente');
        continue;
      }

      await configurarStock.ejecutar(adminActor, sucursalId, insumoId, {
        stockMinimo: spec.stockMinimo,
      });
      await registrarEntrada.ejecutar(adminActor, sucursalId, insumoId, {
        cantidad: spec.cantidad,
        motivo: 'Entrada inicial de demostración',
      });
      anotar(contadores, 'stock_insumos', 'creado');
    }
  }

  // --- Personal: empleados y PIN -------------------------------------------

  const empleadoPorUsuario = new Map<string, string>();

  for (const spec of EMPLEADOS_DEMO) {
    const usuario = requerir(
      usuariosDemo.get(spec.usuario),
      `Error interno del seed demo: falta el usuario "${spec.usuario}".`,
    );
    const empleado = await prisma.empleado.findUnique({
      where: { usuarioId: usuario.id },
      select: { id: true, pinHash: true },
    });

    if (empleado !== null) {
      anotar(contadores, 'empleados', 'existente');
      empleadoPorUsuario.set(spec.usuario, empleado.id);

      if (empleado.pinHash === null) {
        await employeesRepository.guardarPinHash(
          empleado.id,
          await bcrypt.hash(PIN_DEMO, RONDAS_BCRYPT),
        );
        anotar(contadores, 'pines_demo', 'creado');
      }
      continue;
    }

    const creado = await crearEmpleado.ejecutar(adminActor, {
      usuarioId: usuario.id,
      cargo: spec.cargo,
      fechaContratacion: fechaHaceDias(90),
      sucursalId: usuario.sucursalId,
    });
    await employeesRepository.guardarPinHash(
      creado.id,
      await bcrypt.hash(PIN_DEMO, RONDAS_BCRYPT),
    );
    anotar(contadores, 'empleados', 'creado');
    anotar(contadores, 'pines_demo', 'creado');
    empleadoPorUsuario.set(spec.usuario, creado.id);
  }

  // --- Turnos y asignaciones ------------------------------------------------

  const turnosPorSucursal = new Map<string, TurnoRespuesta[]>();

  for (const sucursalId of [centroId, norteId]) {
    const existentes = await shiftsRepository.listarTurnos(
      { page: 1, limit: 100, sucursalId },
      undefined,
    );

    for (const spec of TURNOS_DEMO) {
      if (existentes.some((turno) => mismoTurno(turno, spec))) {
        anotar(contadores, 'turnos', 'existente');
        continue;
      }

      const creado = await crearTurno.ejecutar(adminActor, {
        sucursalId,
        tipo: spec.tipo,
        horaInicio: spec.horaInicio,
        horaFin: spec.horaFin,
        diasSemana: spec.diasSemana,
      });
      existentes.push(creado);
      anotar(contadores, 'turnos', 'creado');
    }

    turnosPorSucursal.set(sucursalId, existentes);
  }

  const asignacionesDemo: {
    empleadoUsuario: string;
    sucursalId: string;
    turno: TurnoComparable;
  }[] = [
    {
      empleadoUsuario: 'empleado.centro',
      sucursalId: centroId,
      turno: TURNOS_DEMO[0],
    },
    {
      empleadoUsuario: 'empleado.norte',
      sucursalId: norteId,
      turno: TURNOS_DEMO[2],
    },
  ];

  for (const spec of asignacionesDemo) {
    const empleadoId = requerir(
      empleadoPorUsuario.get(spec.empleadoUsuario),
      `Error interno del seed demo: falta el empleado de "${spec.empleadoUsuario}".`,
    );
    const existentes =
      await shiftsRepository.listarAsignacionesPorEmpleado(empleadoId);

    if (existentes.length > 0) {
      anotar(contadores, 'asignaciones', 'existente');
      continue;
    }

    const turnos = requerir(
      turnosPorSucursal.get(spec.sucursalId),
      `Error interno del seed demo: faltan los turnos de la sucursal.`,
    );
    const turno = requerir(
      turnos.find((candidato) => mismoTurno(candidato, spec.turno)),
      'Error interno del seed demo: falta el turno para la asignacion.',
    );

    await crearAsignacion.ejecutar(adminActor, {
      empleadoId,
      turnoId: turno.id,
      fechaInicio: hoy(),
    });
    anotar(contadores, 'asignaciones', 'creado');
  }

  // --- Actividad: ventas ----------------------------------------------------

  const ofertasActivasPorSucursal = new Map<string, { id: string }[]>();

  for (const sucursalId of [centroId, norteId]) {
    const carta = await ofertasService.carta(adminActor, sucursalId);
    ofertasActivasPorSucursal.set(
      sucursalId,
      carta.filter((fila) => fila.estado === 'activo').map((fila) => ({ id: fila.id })),
    );
  }

  const ventasPrevias = await prisma.venta.count({
    where: { usuarioId: { in: [gerenteCentro.id, gerenteNorte.id] } },
  });

  if (ventasPrevias > 0) {
    for (let i = 0; i < NUM_VENTAS_DEMO; i += 1) {
      anotar(contadores, 'ventas', 'existente');
    }
    anotar(contadores, 'ventas_anuladas', 'existente');
  } else {
    type VentaCreada = {
      id: string;
      actor: ActorDemo;
      indice: number;
    };
    const creadas: VentaCreada[] = [];

    for (let i = 0; i < NUM_VENTAS_DEMO; i += 1) {
      const sucursalId = i % 2 === 0 ? centroId : norteId;
      const actor = i % 2 === 0 ? gerenteCentro : gerenteNorte;
      const activas = requerir(
        ofertasActivasPorSucursal.get(sucursalId),
        'Error interno del seed demo: faltan las ofertas activas de la sucursal.',
      );
      const base = requerir(
        activas[i % activas.length],
        'No hay ofertas activas para registrar ventas de demostracion.',
      );

      const items = [
        { productoSucursalVarianteId: base.id, cantidad: 1 + (i % 3) },
      ];

      if (i % 5 === 0 && activas.length > 1) {
        const extra = requerir(
          activas[(i + 1) % activas.length],
          'Error interno del seed demo: faltan ofertas activas.',
        );
        items.push({ productoSucursalVarianteId: extra.id, cantidad: 1 });
      }

      const venta = await registrarVenta.ejecutar(actor, {
        metodoPago: i % 4 === 0 ? 'tarjeta' : 'efectivo',
        items,
      });
      anotar(contadores, 'ventas', 'creado');
      creadas.push({ id: venta.id, actor, indice: i });
    }

    // La primera venta se anula el mismo dia para ejercitar esa transicion.
    const primera = requerir(
      creadas[0],
      'No se registro ninguna venta de demostracion.',
    );
    await anularVenta.ejecutar(
      primera.actor,
      primera.id,
      'Error de cobro (demostracion)',
    );
    anotar(contadores, 'ventas_anuladas', 'creado');

    // Las demas se reparten en los ultimos dias. Es la unica escritura directa:
    // el caso de uso sella la hora con `now()` y no admite una fecha.
    const ahora = new Date();
    for (const venta of creadas) {
      if (venta.indice === 0) {
        continue;
      }
      const fecha = new Date(ahora);
      fecha.setDate(ahora.getDate() - venta.indice);
      fecha.setHours(9 + (venta.indice % 8), (venta.indice * 7) % 60, 0, 0);

      await prisma.venta.update({
        where: { id: venta.id },
        data: { createdAt: fecha },
      });
      await prisma.ventaDetalle.updateMany({
        where: { ventaId: venta.id },
        data: { createdAt: fecha },
      });
      anotar(contadores, 'ventas_reubicadas', 'creado');
    }
  }

  // --- Asistencia -----------------------------------------------------------

  const asistenciaDemo: {
    empleadoUsuario: string;
    actor: ActorDemo;
    marcas: ('entrada' | 'salida')[];
  }[] = [
    {
      empleadoUsuario: 'empleado.centro',
      actor: gerenteCentro,
      marcas: ['entrada'],
    },
    {
      empleadoUsuario: 'empleado.norte',
      actor: gerenteNorte,
      marcas: ['entrada', 'salida'],
    },
  ];

  for (const spec of asistenciaDemo) {
    const empleadoId = requerir(
      empleadoPorUsuario.get(spec.empleadoUsuario),
      `Error interno del seed demo: falta el empleado de "${spec.empleadoUsuario}".`,
    );
    const existentes =
      await attendanceRepository.listarRegistrosDeEmpleado(empleadoId);

    if (existentes.length > 0) {
      anotar(contadores, 'asistencia', 'existente');
      continue;
    }

    for (const tipo of spec.marcas) {
      await marcarAsistencia.ejecutar(spec.actor, {
        empleadoId,
        tipo,
        pin: PIN_DEMO,
      });
      anotar(contadores, 'asistencia', 'creado');
    }
  }

  // --- Equipos --------------------------------------------------------------

  for (const sucursalId of [centroId, norteId]) {
    const gerente = gerenteDeSucursal(sucursalId);
    const existentes = await equipmentRepository.listarEquipos({
      sucursalId,
      page: 1,
      limit: 100,
    });

    for (const spec of EQUIPOS_DEMO) {
      if (existentes.some((equipo) => mismoNombre(equipo.nombre, spec.nombre))) {
        anotar(contadores, 'equipos', 'existente');
        continue;
      }

      const creado = await equipmentService.crear(gerente, {
        sucursalId,
        nombre: spec.nombre,
        tipo: spec.tipo,
      });

      if (spec.estado !== 'funcionando') {
        await equipmentService.actualizar(gerente, creado.id, {
          estado: spec.estado,
        });
      }
      anotar(contadores, 'equipos', 'creado');
    }
  }

  return contadores;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function ejecutar(): Promise<void> {
  let app: INestApplicationContext | undefined;

  try {
    asegurarEntornoDemo();
    const password = leerPasswordDemo(process.env);

    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    });
    const prisma = app.get(PrismaService);
    const contadores = await ejecutarDemoSeed(app, prisma, password);

    imprimirResumen(contadores);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error(`\nSeed de demostracion fallido: ${redactar(mensaje)}`);
    process.exitCode = 1;
  } finally {
    if (app !== undefined) {
      await app.close();
    }
  }
}

// Solo se ejecuta cuando este archivo es el programa principal; asi las pruebas
// pueden importar las reglas puras sin disparar el seed como efecto secundario.
if (require.main === module) {
  void ejecutar();
}
