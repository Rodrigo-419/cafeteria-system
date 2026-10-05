// Repositorio de sucursales: consultas Prisma con select explicito.
//
// La tabla `sucursal` no tiene nada sensible, pero aun asi se selecciona campo a
// campo en vez de devolver la fila entera: asi anadir una columna no cambia la
// respuesta de la API por accidente.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { mismoNombreSucursal } from './branches.rules';

/** Fila de sucursal tal y como la devuelve la API. */
export type SucursalRespuesta = {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const SELECT_SUCURSAL = {
  id: true,
  nombre: true,
  direccion: true,
  telefono: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SucursalSelect;

const SELECT_SUCURSAL_NOMBRE = {
  id: true,
  nombre: true,
} satisfies Prisma.SucursalSelect;

@Injectable()
export class BranchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- lecturas

  async buscarPorId(id: string): Promise<SucursalRespuesta | null> {
    return this.prisma.sucursal.findUnique({
      where: { id },
      select: SELECT_SUCURSAL,
    });
  }

  /**
   * Listado acotado a lo que el actor puede ver. Sin `sucursalId` devuelve todas
   * ordenadas por nombre (Admin); con el devuelve unicamente esa.
   */
  async listar(sucursalId?: string): Promise<SucursalRespuesta[]> {
    return this.prisma.sucursal.findMany({
      where: sucursalId !== undefined ? { id: sucursalId } : {},
      select: SELECT_SUCURSAL,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * true si ya existe una sucursal con ese nombre.
   *
   * La comparacion se hace en memoria y no con `mode: 'insensitive'` de Prisma
   * porque la regla es mas fuerte que "ignorar mayusculas": tambien tiene que
   * ignorar los espacios sobrantes, y eso no se expresa en el cliente generado.
   * SeAsume la consecuencia a proposito: la tabla `sucursal` es pequena y
   * acotada (las sedes de una cadena), asi que traer `id` y `nombre` es barato,
   * y evita una consulta SQL a mano.
   *
   * `exceptoSucursalId` deja que la propia sucursal conserve su nombre al
   * editarlo.
   */
  async nombreEnUso(nombre: string, exceptoSucursalId?: string): Promise<boolean> {
    const sucursales = await this.prisma.sucursal.findMany({
      select: SELECT_SUCURSAL_NOMBRE,
    });

    return sucursales.some(
      (s) => s.id !== exceptoSucursalId && mismoNombreSucursal(s.nombre, nombre),
    );
  }

  // --------------------------------------------------------------- escrituras

  async crear(data: {
    nombre: string;
    direccion: string;
    telefono: string | null;
  }): Promise<SucursalRespuesta> {
    return this.prisma.sucursal.create({
      data: {
        nombre: data.nombre,
        direccion: data.direccion,
        telefono: data.telefono,
      },
      select: SELECT_SUCURSAL,
    });
  }

  /**
   * Edicion parcial. Los campos ausentes se omiten del `data` para no escribir
   * `undefined` sobre una columna.
   */
  async actualizar(
    id: string,
    data: { nombre?: string; direccion?: string; telefono?: string | null },
  ): Promise<SucursalRespuesta> {
    return this.prisma.sucursal.update({
      where: { id },
      data,
      select: SELECT_SUCURSAL,
    });
  }
}
