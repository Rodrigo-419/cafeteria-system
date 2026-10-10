// Caso de uso: regenerar el PIN de marcacion de un empleado.
//
// El PIN nuevo se genera aqui, se guarda como hash bcrypt y se devuelve UNA vez
// en la respuesta. En la base no queda el PIN en claro y en ninguna respuesta
// posterior vuelve a aparecer.
import { Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
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
  constructor(private readonly employeesRepository: EmployeesRepository) {}

  async ejecutar(actor: ActorEmpleados, id: string): Promise<PinGenerado> {
    const empleado = await this.employeesRepository.buscarAlcanceEnAlcance(
      id,
      filtroAlcanceEmpleados(actor),
    );

    if (!empleado) {
      throw new NotFoundException('Empleado no encontrado');
    }

    const pin = generarPin();
    const pinHash = await bcrypt.hash(pin, RONDAS_BCRYPT);

    await this.employeesRepository.guardarPinHash(id, pinHash);

    return { pin };
  }
}
