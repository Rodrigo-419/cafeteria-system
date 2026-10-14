// Caso de uso: regenerar el PIN de marcacion de un empleado.
//
// El PIN nuevo se genera aqui, se guarda como hash bcrypt y se devuelve UNA vez
// en la respuesta. En la base no queda el PIN en claro y en ninguna respuesta
// posterior vuelve a aparecer; tampoco viaja en el evento de auditoria. El
// guardado y su evento van en la misma transaccion.
import { Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuditoriaRepository } from '../../../auditoria/infrastructure/auditoria.repository';
import { RONDAS_BCRYPT } from '../../../users/application/use-cases/crear-usuario.use-case';
import {
  filtroAlcanceEmpleados,
  type ActorEmpleados,
} from '../../domain/rules/alcance';
import { generarPin } from '../../domain/rules/pin';
import { EmployeesRepository } from '../../infrastructure/employees.repository';

export type PinGenerado = { pin: string };

@Injectable()
export class RegenerarPinUseCase {
  constructor(
    private readonly employeesRepository: EmployeesRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  async ejecutar(actor: ActorEmpleados, id: string): Promise<PinGenerado> {
    return this.employeesRepository.enTransaccion(async (cliente) => {
      const empleado = await this.employeesRepository.buscarAlcanceEnAlcance(
        id,
        filtroAlcanceEmpleados(actor),
        cliente,
      );

      if (!empleado) {
        throw new NotFoundException('Empleado no encontrado');
      }

      const pin = generarPin();
      const pinHash = await bcrypt.hash(pin, RONDAS_BCRYPT);

      await this.employeesRepository.guardarPinHash(id, pinHash, cliente);

      // El detalle NO lleva el PIN ni su hash.
      await this.auditoria.registrar(
        {
          entidad: 'empleado',
          entidadId: id,
          accion: 'empleado_pin_regenerado',
          actorId: actor.id,
          usuarioAfectadoId: empleado.usuarioId,
          sucursalAfectadaId: empleado.sucursalId,
          detalle: {},
        },
        cliente,
      );

      return { pin };
    });
  }
}
