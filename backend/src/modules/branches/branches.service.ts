// Logica de negocio de sucursales.
//
// El servicio es dueño de las reglas: decide cuando hay conflicto de nombre,
// cuando no existe la sucursal y cuando el actor no puede verla. Las funciones
// puras de `branches.rules.ts` se limitan a responder preguntas; aqui se usan y
// se traducen a excepciones HTTP.
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BranchesRepository,
  type SucursalRespuesta,
} from './branches.repository';
import {
  filtroSucursalesVisibles,
  type ActorSucursales,
  puedeVerSucursal,
} from './branches.rules';

export type { ActorSucursales };

export type EntradaCrearSucursal = {
  nombre: string;
  direccion: string;
  telefono?: string | null;
};

export type EntradaActualizarSucursal = {
  nombre?: string;
  direccion?: string;
  telefono?: string | null;
};

/** Mismo 404 para "no existe" y "no la puedes ver". */
const SUCURSAL_NO_ENCONTRADA = 'Sucursal no encontrada';
const NOMBRE_DUPLICADO = 'Ya existe una sucursal con ese nombre';

@Injectable()
export class BranchesService {
  constructor(private readonly branchesRepository: BranchesRepository) {}

  /**
   * Crea una sucursal. El permiso `sucursales.crear_editar` ya lo exige el
   * guard, asi que aqui solo se valida el nombre duplicado.
   */
  async crear(
    _actor: ActorSucursales,
    entrada: EntradaCrearSucursal,
  ): Promise<SucursalRespuesta> {
    const nombre = recortar(entrada.nombre);

    await this.asegurarNombreLibre(nombre, undefined);

    try {
      return await this.branchesRepository.crear({
        nombre,
        direccion: recortar(entrada.direccion),
        telefono: recortarOpcional(entrada.telefono),
      });
    } catch (error) {
      // Red de seguridad: el indice unico de `sucursal.nombre` es exacto y
      // sensible a mayusculas, asi que dos peticiones simultaneas con el mismo
      // nombre podrian pasar la comprobacion previa y chocar aqui. Se traduce al
      // mismo 409 en vez de dejar escapar un 500.
      this.relanzarSiNombreDuplicado(error);
      throw error;
    }
  }

  /** Edita parcialmente una sucursal. 404 si no existe. */
  async actualizar(
    _actor: ActorSucursales,
    id: string,
    entrada: EntradaActualizarSucursal,
  ): Promise<SucursalRespuesta> {
    const existente = await this.branchesRepository.buscarPorId(id);
    if (!existente) {
      throw new NotFoundException(SUCURSAL_NO_ENCONTRADA);
    }

    const nombre = entrada.nombre !== undefined ? recortar(entrada.nombre) : undefined;

    // Se excluye la propia sucursal: editar sin tocar el nombre, o volver a
    // escribir el mismo nombre con otra capitalizacion, no es un conflicto.
    if (nombre !== undefined) {
      await this.asegurarNombreLibre(nombre, id);
    }

    try {
      return await this.branchesRepository.actualizar(id, {
        ...(nombre !== undefined ? { nombre } : {}),
        ...(entrada.direccion !== undefined
          ? { direccion: recortar(entrada.direccion) }
          : {}),
        ...(entrada.telefono !== undefined
          ? { telefono: recortarOpcional(entrada.telefono) }
          : {}),
      });
    } catch (error) {
      this.relanzarSiNombreDuplicado(error);
      throw error;
    }
  }

  /** Admin: todas ordenadas por nombre. Gerente y Empleado: solo la suya. */
  async listar(actor: ActorSucursales): Promise<SucursalRespuesta[]> {
    // `undefined` = sin filtro = todas (Admin). Para el resto, su unica
    // sucursal; y si el dato faltara, el id centinela que no casa con nadie.
    const filtro = filtroSucursalesVisibles(actor);
    return this.branchesRepository.listar(filtro?.sucursalId);
  }

  /**
   * Obtiene una sucursal aplicando visibilidad. Un Gerente o Empleado que pida
   * otra recibe 404 exista o no, igual que el modulo users con los usuarios.
   */
  async obtener(
    actor: ActorSucursales,
    id: string,
  ): Promise<SucursalRespuesta> {
    const sucursal = await this.branchesRepository.buscarPorId(id);

    if (!sucursal || !puedeVerSucursal(actor, sucursal.id)) {
      throw new NotFoundException(SUCURSAL_NO_ENCONTRADA);
    }

    return sucursal;
  }

  // ------------------------------------------------------------------ privado

  private async asegurarNombreLibre(
    nombre: string,
    exceptoSucursalId: string | undefined,
  ): Promise<void> {
    if (await this.branchesRepository.nombreEnUso(nombre, exceptoSucursalId)) {
      throw new ConflictException(NOMBRE_DUPLICADO);
    }
  }

  /**
   * Traduce la violacion del indice unico de la base al mismo 409 que da la
   * comprobacion previa.
   *
   * Se detecta por la propiedad `code` y no con `instanceof
   * PrismaClientKnownRequestError` a proposito: esa clase vive en el cliente
   * Prisma generado, que solo se puede cargar cuando hay una base de datos
   * delante. Importarla aqui arrastraria el cliente generado a las pruebas
   * unitarias, que no lo necesitan. El error de Prisma es el unico que trae un
   * `code` de este tipo, asi que la comprobacion no es ambigua.
   */
  private relanzarSiNombreDuplicado(error: unknown): void {
    if (esViolacionDeUnicidad(error)) {
      throw new ConflictException(NOMBRE_DUPLICADO);
    }
  }
}

function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

function recortar(valor: string): string {
  return valor.trim();
}

function recortarOpcional(valor: string | null | undefined): string | null {
  return valor === undefined || valor === null ? null : valor.trim();
}
