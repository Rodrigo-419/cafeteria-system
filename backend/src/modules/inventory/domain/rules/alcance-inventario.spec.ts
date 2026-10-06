import {
  exigirAccesoSucursal,
  filtroSucursalAlcance,
  puedeAccederSucursal,
  SIN_ALCANCE,
  type ActorInventario,
} from './alcance-inventario';
import { NotFoundException } from '@nestjs/common';
import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../../../users/domain/roles';

const ROL_DESCONOCIDO = 'supervisor';
const SUC_NORTE = 'suc-norte';
const SUC_SUR = 'suc-sur';

function actor(rol: string | null, sucursalId: string | null = SUC_NORTE): ActorInventario {
  return { id: `usr-${String(rol)}`, rol, sucursalId };
}

describe('alcance del inventario', () => {
  describe('puedeAccederSucursal', () => {
    it('el Admin entra en cualquier sucursal', () => {
      expect(puedeAccederSucursal(actor(ROL_ADMIN, null), SUC_NORTE)).toBe(true);
      expect(puedeAccederSucursal(actor(ROL_ADMIN, null), SUC_SUR)).toBe(true);
    });

    it('el Gerente entra solo en la suya', () => {
      expect(puedeAccederSucursal(actor(ROL_GERENTE), SUC_NORTE)).toBe(true);
      expect(puedeAccederSucursal(actor(ROL_GERENTE), SUC_SUR)).toBe(false);
    });

    it('el Empleado entra solo en la suya', () => {
      expect(puedeAccederSucursal(actor(ROL_EMPLEADO), SUC_NORTE)).toBe(true);
      expect(puedeAccederSucursal(actor(ROL_EMPLEADO), SUC_SUR)).toBe(false);
    });

    it('un Gerente o Empleado sin sucursal no entra en ninguna', () => {
      expect(puedeAccederSucursal(actor(ROL_GERENTE, null), SUC_NORTE)).toBe(false);
      expect(puedeAccederSucursal(actor(ROL_EMPLEADO, null), SUC_NORTE)).toBe(false);
    });

    it('un rol desconocido no entra en ninguna, ni en la suya', () => {
      expect(puedeAccederSucursal(actor(ROL_DESCONOCIDO), SUC_NORTE)).toBe(false);
      expect(puedeAccederSucursal(actor(null), SUC_NORTE)).toBe(false);
      expect(puedeAccederSucursal(actor(''), SUC_NORTE)).toBe(false);
    });
  });

  describe('filtroSucursalAlcance', () => {
    it('el Admin no filtra si no pide sucursal', () => {
      expect(filtroSucursalAlcance(actor(ROL_ADMIN, null))).toBeUndefined();
    });

    it('el Admin filtra por la sucursal que pida', () => {
      expect(filtroSucursalAlcance(actor(ROL_ADMIN, null), SUC_SUR)).toBe(SUC_SUR);
    });

    it('el Gerente queda atado a su sucursal', () => {
      expect(filtroSucursalAlcance(actor(ROL_GERENTE))).toBe(SUC_NORTE);
      expect(filtroSucursalAlcance(actor(ROL_EMPLEADO))).toBe(SUC_NORTE);
    });

    it('el Gerente puede pedir su propia sucursal', () => {
      expect(filtroSucursalAlcance(actor(ROL_GERENTE), SUC_NORTE)).toBe(SUC_NORTE);
      expect(filtroSucursalAlcance(actor(ROL_EMPLEADO), SUC_NORTE)).toBe(SUC_NORTE);
    });

    it('el Gerente recibe 404 si pide otra sucursal, no los datos de la suya', () => {
      // Devolver SUC_NORTE en lugar de SUC_SUR seria un 200 con los datos de una
      // sucursal que no se pidio: el cliente creeria que ha leido lo suyo.
      expect(() => filtroSucursalAlcance(actor(ROL_GERENTE), SUC_SUR)).toThrow(
        NotFoundException,
      );
      expect(() => filtroSucursalAlcance(actor(ROL_EMPLEADO), SUC_SUR)).toThrow(
        NotFoundException,
      );
    });

    it('un rol desconocido recibe el centinela, no todas las sucursales', () => {
      expect(filtroSucursalAlcance(actor(ROL_DESCONOCIDO))).toBe(SIN_ALCANCE);
      expect(filtroSucursalAlcance(actor(ROL_DESCONOCIDO), SUC_SUR)).toBe(SIN_ALCANCE);
    });

    it('un Gerente sin sucursal recibe el centinela', () => {
      expect(filtroSucursalAlcance(actor(ROL_GERENTE, null))).toBe(SIN_ALCANCE);
    });

    it('el centinela no es el id de ninguna sucursal real', () => {
      expect(SIN_ALCANCE).not.toBe(SUC_NORTE);
      expect(SIN_ALCANCE).not.toBe(SUC_SUR);
    });
  });

  describe('exigirAccesoSucursal', () => {
    it('no lanza cuando la sucursal esta dentro del alcance', () => {
      expect(() =>
        exigirAccesoSucursal(actor(ROL_ADMIN, null), SUC_SUR),
      ).not.toThrow();
      expect(() => exigirAccesoSucursal(actor(ROL_GERENTE), SUC_NORTE)).not.toThrow();
      expect(() => exigirAccesoSucursal(actor(ROL_EMPLEADO), SUC_NORTE)).not.toThrow();
    });

    it('responde 404, no 403, cuando queda fuera del alcance', () => {
      // Un 403 confirmaria que la sucursal existe.
      for (const rol of [ROL_GERENTE, ROL_EMPLEADO, ROL_DESCONOCIDO, null]) {
        expect(() => exigirAccesoSucursal(actor(rol), SUC_SUR)).toThrow(
          NotFoundException,
        );
      }
    });

    it('el mensaje no revela nada sobre la sucursal', () => {
      let mensaje = '';

      try {
        exigirAccesoSucursal(actor(ROL_GERENTE), SUC_SUR);
      } catch (error) {
        mensaje = (error as NotFoundException).message;
      }

      expect(mensaje).toBe('La sucursal no existe');
    });

    it('un rol desconocido no entra ni en la sucursal que seria la suya', () => {
      expect(() =>
        exigirAccesoSucursal(actor(ROL_DESCONOCIDO), SUC_NORTE),
      ).toThrow(NotFoundException);
    });
  });
});
