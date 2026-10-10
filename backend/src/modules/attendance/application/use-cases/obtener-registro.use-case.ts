// Caso de uso: obtener un registro de asistencia con sus correcciones.
//
// Devuelve el registro EFECTIVO (su hora y si sigue abierto) y la lista de
// correcciones que recibio el original. Un registro fuera del alcance responde
// 404, igual que uno inexistente.
import { Injectable, NotFoundException } from '@nestjs/common';
import { filtroAlcanceAsistencia, type ActorAsistencia } from '../../domain/rules/alcance';
import { derivarAsistencia } from '../../domain/rules/registros-efectivos';
import {
  AttendanceRepository,
  type RegistroRespuesta,
} from '../../infrastructure/attendance.repository';

export type CorreccionDetalle = {
  id: string;
  tipo: string;
  fechaHora: Date;
  metodo: string;
  motivo: string | null;
  usuarioCorrectorId: string | null;
  createdAt: Date;
};

export type RegistroDetalle = {
  id: string;
  empleadoId: string;
  sucursalId: string;
  tipo: string;
  fechaHora: Date;
  metodo: string;
  abierta: boolean;
  corregido: boolean;
  empleado: { id: string; nombre: string };
  correcciones: CorreccionDetalle[];
};

@Injectable()
export class ObtenerRegistroUseCase {
  constructor(private readonly repository: AttendanceRepository) {}

  async ejecutar(actor: ActorAsistencia, id: string): Promise<RegistroDetalle> {
    const conEmpleado = await this.repository.buscarRegistroEnAlcance(
      id,
      filtroAlcanceAsistencia(actor),
    );
    if (conEmpleado === null) {
      throw new NotFoundException('Registro no encontrado');
    }

    const { registro, empleado } = conEmpleado;

    if (registro.esCorreccion) {
      return {
        id: registro.id,
        empleadoId: registro.empleadoId,
        sucursalId: registro.sucursalId,
        tipo: registro.tipo,
        fechaHora: registro.fechaHora,
        metodo: registro.metodo,
        abierta: false,
        corregido: false,
        empleado: { id: registro.empleadoId, nombre: empleado.nombre },
        correcciones: [],
      };
    }

    const historial = await this.repository.listarRegistrosDeEmpleado(
      registro.empleadoId,
    );
    const derivacion = derivarAsistencia(historial);
    const derivado = derivacion.registros.find((item) => item.id === registro.id);

    const correcciones = await this.repository.listarCorreccionesDe(registro.id);

    return {
      id: registro.id,
      empleadoId: registro.empleadoId,
      sucursalId: registro.sucursalId,
      tipo: derivado?.tipo ?? registro.tipo,
      fechaHora: derivado?.fechaHora ?? registro.fechaHora,
      metodo: registro.metodo,
      abierta: derivado?.abierta ?? false,
      corregido: derivado?.corregido ?? correcciones.length > 0,
      empleado: { id: registro.empleadoId, nombre: empleado.nombre },
      correcciones: correcciones.map(aCorreccionDetalle),
    };
  }
}

function aCorreccionDetalle(registro: RegistroRespuesta): CorreccionDetalle {
  return {
    id: registro.id,
    tipo: registro.tipo,
    fechaHora: registro.fechaHora,
    metodo: registro.metodo,
    motivo: registro.motivo,
    usuarioCorrectorId: registro.usuarioCorrectorId,
    createdAt: registro.createdAt,
  };
}