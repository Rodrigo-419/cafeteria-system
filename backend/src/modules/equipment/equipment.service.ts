// Servicio con la logica de negocio de equipos.

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  puedeAccederEquipo,
  esTransicionEstadoValida,
  esEstadoTerminal,
  hayCambioNombre,
  hayCambioTexto,
  requiereHistorial,
  filtroEquiposVisibles,
  SIN_ALCANCE_EQUIPO,
  type EstadoEquipo,
  type ActorEquipos,
} from './domain/rules/equipment.rules';
import { esAdmin } from '../users/domain/roles';
import { AuditoriaRepository } from '../auditoria/infrastructure/auditoria.repository';
import { EquipmentRepository } from './equipment.repository';
import { pagina, type Paginado } from '../sales/application/paginado';
import type {
  ClienteEquipo,
  EquipoFila,
  HistorialEquipoFila,
} from './equipment.repository';

export type EntradaCrearEquipo = {
  sucursalId: string;
  nombre: string;
  tipo: string;
  observaciones?: string | null;
};

export type EntradaActualizarEquipo = {
  nombre?: string;
  tipo?: string;
  estado?: EstadoEquipo;
  observaciones?: string | null;
};

export type FiltrosListarEquipos = {
  sucursalId?: string;
  estado?: EstadoEquipo;
  busqueda?: string;
  page: number;
  limit: number;
};

export type FiltrosListarHistorial = {
  page: number;
  limit: number;
};

@Injectable()
export class EquipmentService {
  constructor(
    private readonly repository: EquipmentRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  async crear(actor: ActorEquipos, entrada: EntradaCrearEquipo): Promise<EquipoFila> {
    let sucursalId = entrada.sucursalId;

    if (esAdmin(actor.rol)) {
      sucursalId = entrada.sucursalId;
    } else {
      if (actor.sucursalId === null || actor.sucursalId === undefined) {
        throw new ForbiddenException('Acceso denegado');
      }
      sucursalId = actor.sucursalId;
    }

    const sucursalResuelta = sucursalId;

    return this.repository.enTransaccion(async (tx) => {
      if (
        esAdmin(actor.rol) &&
        !(await this.repository.existeSucursal(sucursalResuelta, tx))
      ) {
        throw new NotFoundException('La sucursal no existe');
      }

      const equipo = await this.repository.crearEquipo(
        {
          sucursalId: sucursalResuelta,
          nombre: entrada.nombre.trim(),
          tipo: entrada.tipo.trim(),
          observaciones: entrada.observaciones !== undefined && entrada.observaciones !== null ? entrada.observaciones.trim() || null : null,
        },
        tx,
      );

      await this.auditoria.registrar(
        {
          entidad: 'equipo',
          entidadId: equipo.id,
          accion: 'equipo_creado',
          actorId: actor.id,
          sucursalAfectadaId: equipo.sucursalId,
          detalle: {
            despues: {
              nombre: equipo.nombre,
              tipo: equipo.tipo,
              estado: equipo.estado,
              observaciones: equipo.observaciones,
            },
          },
        },
        tx,
      );

      return equipo;
    });
  }

  async actualizar(
    actor: ActorEquipos,
    id: string,
    entrada: EntradaActualizarEquipo,
  ): Promise<EquipoFila> {
    return this.repository.enTransaccion(async (tx) => {
      const equipo = await this.repository.obtenerEquipoConBloqueo(id, tx);
      if (equipo === null) {
        throw new NotFoundException('El equipo no existe');
      }

      if (!puedeAccederEquipo(actor, equipo.sucursalId)) {
        throw new NotFoundException('El equipo no existe');
      }

      let nuevoEstado = equipo.estado;
      if (entrada.estado !== undefined) {
        if (!esTransicionEstadoValida(equipo.estado, entrada.estado)) {
          if (esEstadoTerminal(equipo.estado)) {
            throw new ConflictException('El equipo ya esta retirado');
          }
          throw new BadRequestException('Transicion de estado no valida');
        }
        nuevoEstado = entrada.estado;
      }

      const nuevoNombre = entrada.nombre !== undefined ? entrada.nombre : equipo.nombre;
      const nuevoTipo = entrada.tipo !== undefined ? entrada.tipo : equipo.tipo;
      const nuevasObs =
        entrada.observaciones !== undefined && entrada.observaciones !== null
          ? entrada.observaciones.trim() === ''
            ? null
            : entrada.observaciones.trim()
          : equipo.observaciones;

      const nombreCambia = hayCambioNombre(equipo.nombre, nuevoNombre);
      const tipoCambia = hayCambioTexto(equipo.tipo, nuevoTipo);
      const estadoCambia = equipo.estado !== nuevoEstado;
      const obsCambia = hayCambioTexto(equipo.observaciones, nuevasObs);

      if (!nombreCambia && !tipoCambia && !estadoCambia && !obsCambia) {
        return equipo;
      }

      const equipoActualizado = await this.repository.actualizarEquipo(
        id,
        {
          nombre: nuevoNombre.trim(),
          tipo: nuevoTipo.trim(),
          estado: nuevoEstado,
          observaciones: nuevasObs,
        },
        tx,
      );

      if (requiereHistorial(estadoCambia, obsCambia)) {
        await this.repository.crearHistorial(
          {
            equipoId: id,
            estadoAnterior: equipo.estado,
            estadoNuevo: nuevoEstado,
            observacionesAnterior: equipo.observaciones,
            observacionesNuevas: nuevasObs,
            usuarioId: actor.id,
          },
          tx,
        );
      }

      await this.registrarAuditoria(
        actor,
        equipo,
        equipoActualizado,
        { nombreCambia, tipoCambia, estadoCambia, obsCambia },
        tx,
      );

      return equipoActualizado;
    });
  }

  /**
   * Deja eventos de auditoria para los cambios reales: `equipo_editado` para
   * nombre/tipo/observaciones y `equipo_estado_cambiado` para el estado. Un PATCH
   * sin cambios reales no llega aqui (se corta antes).
   */
  private async registrarAuditoria(
    actor: ActorEquipos,
    equipo: EquipoFila,
    equipoActualizado: EquipoFila,
    cambios: {
      nombreCambia: boolean;
      tipoCambia: boolean;
      estadoCambia: boolean;
      obsCambia: boolean;
    },
    cliente: ClienteEquipo,
  ): Promise<void> {
    if (cambios.estadoCambia) {
      await this.auditoria.registrar(
        {
          entidad: 'equipo',
          entidadId: equipo.id,
          accion: 'equipo_estado_cambiado',
          actorId: actor.id,
          sucursalAfectadaId: equipoActualizado.sucursalId,
          detalle: {
            antes: { estado: equipo.estado },
            despues: { estado: equipoActualizado.estado },
          },
        },
        cliente,
      );
    }

    if (cambios.nombreCambia || cambios.tipoCambia || cambios.obsCambia) {
      const antes: Record<string, unknown> = {};
      const despues: Record<string, unknown> = {};

      if (cambios.nombreCambia) {
        antes.nombre = equipo.nombre;
        despues.nombre = equipoActualizado.nombre;
      }
      if (cambios.tipoCambia) {
        antes.tipo = equipo.tipo;
        despues.tipo = equipoActualizado.tipo;
      }
      if (cambios.obsCambia) {
        antes.observaciones = equipo.observaciones;
        despues.observaciones = equipoActualizado.observaciones;
      }

      await this.auditoria.registrar(
        {
          entidad: 'equipo',
          entidadId: equipo.id,
          accion: 'equipo_editado',
          actorId: actor.id,
          sucursalAfectadaId: equipoActualizado.sucursalId,
          detalle: { antes, despues },
        },
        cliente,
      );
    }
  }

  async obtener(actor: ActorEquipos, id: string): Promise<EquipoFila> {
    const equipo = await this.repository.buscarEquipoPorId(id);
    if (equipo === null) {
      throw new NotFoundException('El equipo no existe');
    }
    if (!puedeAccederEquipo(actor, equipo.sucursalId)) {
      throw new NotFoundException('El equipo no existe');
    }
    return equipo;
  }

  async listar(
    actor: ActorEquipos,
    filtros: FiltrosListarEquipos,
  ): Promise<Paginado<EquipoFila>> {
    const filtroSucursal = filtroEquiposVisibles(actor)?.sucursalId;

    const filtroSucursalEfectivo =
      filtros.sucursalId !== undefined && filtroSucursal === undefined
        ? filtros.sucursalId
        : filtroSucursal;

    if (filtroSucursalEfectivo === SIN_ALCANCE_EQUIPO) {
      return pagina([], 0, filtros.page, filtros.limit);
    }

    const data = await this.repository.listarEquipos({
      sucursalId: filtroSucursalEfectivo,
      estado: filtros.estado,
      busqueda: filtros.busqueda,
      page: filtros.page,
      limit: filtros.limit,
    });

    const total = await this.repository.contarEquipos({
      sucursalId: filtroSucursalEfectivo,
      estado: filtros.estado,
      busqueda: filtros.busqueda,
    });

    return pagina(data, total, filtros.page, filtros.limit);
  }

  async listarHistorial(
    actor: ActorEquipos,
    id: string,
    filtros: FiltrosListarHistorial,
  ): Promise<Paginado<HistorialEquipoFila>> {
    const equipo = await this.repository.buscarEquipoPorId(id);
    if (equipo === null) {
      throw new NotFoundException('El equipo no existe');
    }
    if (!puedeAccederEquipo(actor, equipo.sucursalId)) {
      throw new NotFoundException('El equipo no existe');
    }

    const data = await this.repository.listarHistorial({
      equipoId: id,
      page: filtros.page,
      limit: filtros.limit,
    });
    const total = await this.repository.contarHistorial(id);

    return pagina(data, total, filtros.page, filtros.limit);
  }
}
