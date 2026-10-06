import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ROL_ADMIN,
  ROL_EMPLEADO,
  ROL_GERENTE,
} from '../../../users/domain/roles';
import {
  SIN_ALCANCE,
  exigirAccesoSucursal,
  exigirSucursalDeRegistro,
  filtroSucursalAlcance,
  puedeAccederSucursal,
  type ActorVentas,
} from './alcance-ventas';

const ROL_DESCONOCIDO = 'supervisor';
const SUC_NORTE = 'suc-norte';
const SUC_SUR = 'suc-sur';

function actor(
  rol: string | null,
  sucursalId: string | null = SUC_NORTE,
): ActorVentas {
  return { id: `usr-${String(rol)}`, rol, sucursalId };
}

describe('alcance de las ventas', () => {
  describe('puedeAccederSucursal', () => {
    it('el Admin entra en cualquier sucursal', () => {
      expect(puedeAccederSucursal(actor(ROL_ADMIN, null), SUC_NORTE)).toBe(true);
      expect(puedeAccederSucursal(actor(ROL_ADMIN, null), SUC_SUR)).toBe(true);
    });

    it('el Gerente y el Empleado entran solo en la suya', () => {
      expect(puedeAccederSucursal(actor(ROL_GERENTE), SUC_NORTE)).toBe(true);
      expect(puedeAccederSucursal(actor(ROL_GERENTE), SUC_SUR)).toBe(false);
      expect(puedeAccederSucursal(actor(ROL_EMPLEADO), SUC_NORTE)).toBe(true);
      expect(puedeAccederSucursal(actor(ROL_EMPLEADO), SUC_SUR)).toBe(false);
    });

    it('es deny-by-default para cualquier otro rol', () => {
      expect(puedeAccederSucursal(actor(ROL_DESCONOCIDO), SUC_NORTE)).toBe(false);
      expect(puedeAccederSucursal(actor(null), SUC_NORTE)).toBe(false);
      expect(puedeAccederSucursal(actor(ROL_GERENTE, null), SUC_NORTE)).toBe(false);
    });
  });

  describe('exigirSucursalDeRegistro', () => {
    it('devuelve la sucursal en la que vende el actor', () => {
      expect(exigirSucursalDeRegistro(actor(ROL_GERENTE))).toBe(SUC_NORTE);
      expect(exigirSucursalDeRegistro(actor(ROL_EMPLEADO))).toBe(SUC_NORTE);
    });

    it('responde 403, no 404, a quien no tiene sucursal', () => {
      // No hay recurso que ocultar: el usuario no puede vender en ninguna.
      expect(() => exigirSucursalDeRegistro(actor(ROL_ADMIN, null))).toThrow(
        ForbiddenException,
      );
      expect(() => exigirSucursalDeRegistro(actor(ROL_GERENTE, null))).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('exigirAccesoSucursal', () => {
    it('no lanza cuando la venta esta dentro del alcance', () => {
      expect(() =>
        exigirAccesoSucursal(actor(ROL_ADMIN, null), SUC_SUR),
      ).not.toThrow();
      expect(() => exigirAccesoSucursal(actor(ROL_GERENTE), SUC_NORTE)).not.toThrow();
    });

    it('responde 404, no 403, cuando queda fuera del alcance', () => {
      // Un 403 confirmaria que esa venta existe.
      expect(() => exigirAccesoSucursal(actor(ROL_GERENTE), SUC_SUR)).toThrow(
        NotFoundException,
      );
      expect(() => exigirAccesoSucursal(actor(ROL_EMPLEADO), SUC_SUR)).toThrow(
        NotFoundException,
      );
    });

    it('usa el mensaje del recurso que se pidio', () => {
      let mensaje = '';

      try {
        exigirAccesoSucursal(actor(ROL_GERENTE), SUC_SUR, 'La venta no existe');
      } catch (error) {
        mensaje = (error as NotFoundException).message;
      }

      expect(mensaje).toBe('La venta no existe');
    });
  });

  describe('filtroSucursalAlcance', () => {
    it('al Admin lo deja mirar todas o solo una', () => {
      expect(filtroSucursalAlcance(actor(ROL_ADMIN, null))).toBeUndefined();
      expect(filtroSucursalAlcance(actor(ROL_ADMIN, null), SUC_SUR)).toBe(SUC_SUR);
    });

    it('ata al Gerente y al Empleado a su sucursal', () => {
      expect(filtroSucursalAlcance(actor(ROL_GERENTE))).toBe(SUC_NORTE);
      expect(filtroSucursalAlcance(actor(ROL_EMPLEADO))).toBe(SUC_NORTE);
      expect(filtroSucursalAlcance(actor(ROL_GERENTE), SUC_NORTE)).toBe(SUC_NORTE);
    });

    it('responde 404 si piden la sucursal de otro, no los datos de la suya', () => {
      expect(() => filtroSucursalAlcance(actor(ROL_GERENTE), SUC_SUR)).toThrow(
        NotFoundException,
      );
      expect(() => filtroSucursalAlcance(actor(ROL_EMPLEADO), SUC_SUR)).toThrow(
        NotFoundException,
      );
    });

    it('da el centinela a un rol que no es ninguno de los tres', () => {
      expect(filtroSucursalAlcance(actor(ROL_DESCONOCIDO))).toBe(SIN_ALCANCE);
      expect(filtroSucursalAlcance(actor(null))).toBe(SIN_ALCANCE);
      expect(filtroSucursalAlcance(actor(ROL_GERENTE, null))).toBe(SIN_ALCANCE);
      // Un listado sin filtro nunca le vende el historial entero.
      expect(SIN_ALCANCE).not.toBe(SUC_NORTE);
    });
  });
});
