// Caso de uso: listar registros efectivos de asistencia.
//
// La lectura usa el registro EFECTIVO: la hora puede venir de una correccion y
// "abierta" refleja el emparejamiento completo del historial. Por eso la base
// solo filtra por alcance y empleado/sucursal, y el rango de fechas, el filtro
// `abierta` y la paginacion se aplican sobre lo ya derivado, en memoria.
// Limitacion aceptada de momento: ante volumenes grandes habria que poder
// derivar en la base.
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fechaLocalDe } from '../../domain/fechas';
import { filtroAlcanceAsistencia, type ActorAsistencia } from '../../domain/rules/alcance';
import { derivarAsistencia } from '../../domain/rules/registros-efectivos';
import {
  AttendanceRepository,
  type RegistroRespuesta,
} from '../../infrastructure/attendance.repository';

export type ListarRegistrosFiltros = {
  page: number;
  limit: number;
  empleadoId?: string;
  sucursalId?: string;
  desde?: string;
  hasta?: string;
  abierta?: boolean;
};

export type RegistroListadoItem = {
  id: string;
  empleadoId: string;
  sucursalId: string;
  tipo: string;
  fechaHora: Date;
  metodo: string;
  abierta: boolean;
  corregido: boolean;
  empleado: { id: string; nombre: string };
};

export type RegistroListadoRespuesta = {
  items: RegistroListadoItem[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class ListarRegistrosUseCase {
  constructor(private readonly repository: AttendanceRepository) {}

  async ejecutar(
    actor: ActorAsistencia,
    filtros: ListarRegistrosFiltros,
  ): Promise<RegistroListadoRespuesta> {
    const alcance = filtroAlcanceAsistencia(actor);
    const empleados = await this.repository.listarEmpleadosDeAlcance(alcance, {
      empleadoId: filtros.empleadoId,
      sucursalId: filtros.sucursalId,
    });

    if (
      (filtros.empleadoId !== undefined || filtros.sucursalId !== undefined) &&
      empleados.length === 0
    ) {
      throw new NotFoundException(
        'El empleado o la sucursal no esta dentro de tu alcance',
      );
    }

    if (empleados.length === 0) {
      return {
        items: [],
        total: 0,
        page: filtros.page,
        limit: filtros.limit,
      };
    }

    const registros = await this.repository.listarRegistrosDeEmpleados(
      empleados.map((empleado) => empleado.id),
    );

    const historialPorEmpleado = new Map<string, RegistroRespuesta[]>();
    for (const registro of registros) {
      const historial =
        historialPorEmpleado.get(registro.empleadoId) ?? [];
      historial.push(registro);
      historialPorEmpleado.set(registro.empleadoId, historial);
    }

    const items: RegistroListadoItem[] = [];

    for (const empleado of empleados) {
      const historial = historialPorEmpleado.get(empleado.id) ?? [];
      const derivacion = derivarAsistencia(historial);
      const originalPorId = new Map(
        historial
          .filter((registro) => !registro.esCorreccion)
          .map((registro) => [registro.id, registro] as const),
      );

      for (const derivado of derivacion.registros) {
        const original = originalPorId.get(derivado.id);
        if (original === undefined) {
          continue;
        }

        const diaEfectivo = fechaLocalDe(derivado.fechaHora);
        if (filtros.desde !== undefined && diaEfectivo < filtros.desde) {
          continue;
        }
        if (filtros.hasta !== undefined && diaEfectivo > filtros.hasta) {
          continue;
        }
        if (
          filtros.abierta !== undefined &&
          derivado.abierta !== filtros.abierta
        ) {
          continue;
        }

        items.push({
          id: derivado.id,
          empleadoId: empleado.id,
          sucursalId: original.sucursalId,
          tipo: derivado.tipo,
          fechaHora: derivado.fechaHora,
          metodo: original.metodo,
          abierta: derivado.abierta,
          corregido: derivado.corregido,
          empleado: { id: empleado.id, nombre: empleado.nombre },
        });
      }
    }

    items.sort(
      (a, b) =>
        b.fechaHora.getTime() - a.fechaHora.getTime() ||
        (a.id < b.id ? 1 : -1),
    );

    const total = items.length;
    const inicio = (filtros.page - 1) * filtros.limit;

    return {
      items: items.slice(inicio, inicio + filtros.limit),
      total,
      page: filtros.page,
      limit: filtros.limit,
    };
  }
}