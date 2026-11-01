// Pruebas de la regla de alcance de la auditoria.
//
// El punto delicado son las exportaciones: no llevan `usuarioAfectadoId` ni
// `sucursalAfectadaId`, asi que no pueden filtrarse por sucursal. Se limitan
// por `actorId`: cada Gerente ve las suyas y nunca las de otro usuario.
import { AuditoriaEntidad } from '../../../generated/prisma/client';
import { whereDeAlcanceAuditoria } from '../infrastructure/auditoria.repository';
import { alcanceDeActor } from './alcance-auditoria';

const GERENTE_CENTRO = {
  id: 'gerente-centro',
  rol: 'Gerente',
  sucursalId: 'sucursal-centro',
};

const GERENTE_NORTE = {
  id: 'gerente-norte',
  rol: 'Gerente',
  sucursalId: 'sucursal-norte',
};

/** Extrae la condicion de exportacion de un where de alcance. */
function condicionExportacion(where: any): any {
  return (where.OR ?? []).find(
    (condicion: any) =>
      condicion.entidad === AuditoriaEntidad.exportacion,
  );
}

describe('alcance de la auditoria', () => {
  it('el Admin ve todo', () => {
    const alcance = alcanceDeActor({
      id: 'admin',
      rol: 'Admin',
      sucursalId: null,
    });

    expect(alcance).toEqual({ tipo: 'global' });
    expect(whereDeAlcanceAuditoria(alcance!)).toEqual({});
  });

  it('el Gerente queda atado a su sucursal y a su propio actor', () => {
    expect(alcanceDeActor(GERENTE_CENTRO)).toEqual({
      tipo: 'sucursal',
      sucursalId: 'sucursal-centro',
      actorId: 'gerente-centro',
    });
  });

  it('dos Gerentes ven exportaciones distintas: solo las propias', () => {
    const alcanceCentro = alcanceDeActor(GERENTE_CENTRO)!;
    const alcanceNorte = alcanceDeActor(GERENTE_NORTE)!;

    const exportacionCentro = condicionExportacion(
      whereDeAlcanceAuditoria(alcanceCentro),
    );
    const exportacionNorte = condicionExportacion(
      whereDeAlcanceAuditoria(alcanceNorte),
    );

    expect(exportacionCentro).toEqual({
      entidad: AuditoriaEntidad.exportacion,
      actorId: 'gerente-centro',
    });
    expect(exportacionNorte).toEqual({
      entidad: AuditoriaEntidad.exportacion,
      actorId: 'gerente-norte',
    });
    expect(exportacionCentro.actorId).not.toBe(exportacionNorte.actorId);
  });

  it('la exportacion del Admin nunca entra en el alcance de un Gerente', () => {
    const where = whereDeAlcanceAuditoria(alcanceDeActor(GERENTE_CENTRO)!);
    const exportacion = condicionExportacion(where);

    expect(exportacion.actorId).toBe('gerente-centro');
    expect(exportacion.actorId).not.toBe('admin');
  });

  it('el Gerente conserva el alcance de personas y operativos de su sucursal', () => {
    const where = whereDeAlcanceAuditoria(alcanceDeActor(GERENTE_CENTRO)!);
    const serializado = JSON.stringify(where);

    expect(serializado).toContain('"sucursalId":"sucursal-centro"');
    expect(serializado).not.toContain('sucursal-norte');
  });

  it('un Empleado no puede leer la auditoria', () => {
    expect(
      alcanceDeActor({ id: 'empleado', rol: 'Empleado', sucursalId: 's' }),
    ).toBeNull();
  });

  it('un Gerente sin sucursal no puede leer la auditoria', () => {
    expect(
      alcanceDeActor({ id: 'gerente', rol: 'Gerente', sucursalId: null }),
    ).toBeNull();
  });
});
