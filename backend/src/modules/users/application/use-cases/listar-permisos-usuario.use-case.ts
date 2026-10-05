// Caso de uso: listar los permisos efectivos de un usuario indicando el origen
// de cada uno (rol, concedido o revocado).
import { Injectable, NotFoundException } from '@nestjs/common';
import { calcularPermisosEfectivos } from '../../../auth/domain/calcular-permisos-efectivos';
import { Actor, filtroAlcanceListado } from '../../domain/rules/alcance';
import { UsersRepository } from '../../infrastructure/users.repository';

export type OrigenPermiso = 'rol' | 'concedido' | 'revocado';

export type PermisoEfectivo = {
  permisoId: string;
  codigo: string;
  descripcion: string;
  origen: OrigenPermiso;
  efectivo: boolean;
};

@Injectable()
export class ListarPermisosUsuarioUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async ejecutar(actor: Actor, id: string): Promise<PermisoEfectivo[]> {
    const alcance = filtroAlcanceListado(actor);
    const objetivo = await this.usersRepository.buscarPorIdEnAlcance(id, alcance);

    if (!objetivo) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const [individuales, porDefecto] = await Promise.all([
      this.usersRepository.permisosIndividuales(id),
      this.usersRepository.permisosPorDefectoDeRol(objetivo.rolId),
    ]);

    // Todos los permisos conocidos: los del rol mas los individuales.
    const todos = new Map<
      string,
      { permisoId: string; codigo: string; descripcion: string }
    >();
    for (const p of porDefecto) {
      todos.set(p.permisoId, {
        permisoId: p.permisoId,
        codigo: p.codigo,
        descripcion: p.descripcion,
      });
    }
    for (const p of individuales) {
      todos.set(p.permisoId, {
        permisoId: p.permisoId,
        codigo: p.permiso.codigo,
        descripcion: p.permiso.descripcion,
      });
    }

    const tipoPorPermiso = new Map(individuales.map((p) => [p.permisoId, p.tipo]));

    const efectivos = new Set(
      calcularPermisosEfectivos(
        porDefecto.map((p) => p.codigo),
        individuales.map((p) => ({ codigo: p.permiso.codigo, tipo: p.tipo })),
      ),
    );

    return [...todos.values()]
      .map((p) => {
        const tipoIndividual = tipoPorPermiso.get(p.permisoId);
        return {
          permisoId: p.permisoId,
          codigo: p.codigo,
          descripcion: p.descripcion,
          origen: origenDe(tipoIndividual),
          efectivo: efectivos.has(p.codigo),
        };
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }
}

/**
 * Origen de la fila mostrada: lo mas especifico gana. Un permiso revocado
 * sigue figurando como "revocado" aunque su rol lo conceda, porque es el
 * ajuste individual el que manda. Sin ajuste individual, el origen es el rol.
 */
function origenDe(tipoIndividual: string | undefined): OrigenPermiso {
  if (tipoIndividual === 'concedido') {
    return 'concedido';
  }
  if (tipoIndividual === 'revocado') {
    return 'revocado';
  }
  return 'rol';
}