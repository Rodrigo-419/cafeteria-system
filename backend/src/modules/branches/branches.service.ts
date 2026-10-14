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
import { AuditoriaRepository } from '../auditoria/infrastructure/auditoria.repository';
import {
  BranchesRepository,
  type ClienteSucursales,
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
  constructor(
    private readonly branchesRepository: BranchesRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  /**
   * Crea una sucursal. El permiso `sucursales.crear_editar` ya lo exige el
   * guard, asi que aqui solo se valida el nombre duplicado.
   *
   * La comprobacion, la escritura y el evento de auditoria van en la misma
   * transaccion: si algo falla, no queda ni sucursal ni evento.
   */
  async crear(
    actor: ActorSucursales,
    entrada: EntradaCrearSucursal,
  ): Promise<SucursalRespuesta> {
    const nombre = recortar(entrada.nombre);
    const direccion = recortar(entrada.direccion);
    const telefono = recortarOpcional(entrada.telefono);

    try {
      return await this.branchesRepository.enTransaccion(async (cliente) => {
        await this.asegurarNombreLibre(nombre, undefined, cliente);

        const sucursal = await this.branchesRepository.crear(
          { nombre, direccion, telefono },
          cliente,
        );

        await this.auditoria.registrar(
          {
            entidad: 'sucursal',
            entidadId: sucursal.id,
            accion: 'sucursal_creada',
            actorId: actor.id,
            detalle: {
              despues: {
                nombre: sucursal.nombre,
                direccion: sucursal.direccion,
                telefono: sucursal.telefono,
              },
            },
          },
          cliente,
        );

        return sucursal;
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
    actor: ActorSucursales,
    id: string,
    entrada: EntradaActualizarSucursal,
  ): Promise<SucursalRespuesta> {
    const nombre = entrada.nombre !== undefined ? recortar(entrada.nombre) : undefined;
    const direccion =
      entrada.direccion !== undefined ? recortar(entrada.direccion) : undefined;
    const telefono =
      entrada.telefono !== undefined ? recortarOpcional(entrada.telefono) : undefined;

    try {
      return await this.branchesRepository.enTransaccion(async (cliente) => {
        const existente = await this.branchesRepository.buscarPorId(id, cliente);
        if (!existente) {
          throw new NotFoundException(SUCURSAL_NO_ENCONTRADA);
        }

        // Se excluye la propia sucursal: editar sin tocar el nombre, o volver a
        // escribir el mismo nombre con otra capitalizacion, no es un conflicto.
        if (nombre !== undefined) {
          await this.asegurarNombreLibre(nombre, id, cliente);
        }

        const actualizado = await this.branchesRepository.actualizar(
          id,
          {
            ...(nombre !== undefined ? { nombre } : {}),
            ...(direccion !== undefined ? { direccion } : {}),
            ...(telefono !== undefined ? { telefono } : {}),
          },
          cliente,
        );

        await this.registrarEdicion(actor, existente, actualizado, cliente);

        return actualizado;
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

  /**
   * Escribe un `sucursal_editada` con los campos que cambiaron de verdad. Un
   * PATCH sin cambios reales no deja evento.
   */
  private async registrarEdicion(
    actor: ActorSucursales,
    existente: SucursalRespuesta,
    actualizado: SucursalRespuesta,
    cliente: ClienteSucursales,
  ): Promise<void> {
    const antes: Record<string, unknown> = {};
    const despues: Record<string, unknown> = {};

    if (actualizado.nombre !== existente.nombre) {
      antes.nombre = existente.nombre;
      despues.nombre = actualizado.nombre;
    }
    if (actualizado.direccion !== existente.direccion) {
      antes.direccion = existente.direccion;
      despues.direccion = actualizado.direccion;
    }
    if (actualizado.telefono !== existente.telefono) {
      antes.telefono = existente.telefono;
      despues.telefono = actualizado.telefono;
    }

    if (Object.keys(despues).length === 0) {
      return;
    }

    await this.auditoria.registrar(
      {
        entidad: 'sucursal',
        entidadId: actualizado.id,
        accion: 'sucursal_editada',
        actorId: actor.id,
        detalle: { antes, despues },
      },
      cliente,
    );
  }

  private async asegurarNombreLibre(
    nombre: string,
    exceptoSucursalId: string | undefined,
    cliente?: ClienteSucursales,
  ): Promise<void> {
    if (
      await this.branchesRepository.nombreEnUso(nombre, exceptoSucursalId, cliente)
    ) {
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
