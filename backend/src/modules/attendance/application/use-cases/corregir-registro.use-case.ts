// Caso de uso: corregir un registro de asistencia.
//
// Una correccion es una fila NUEVA que apunta a la original (inmutable, el
// trigger lo impide) con su motivo y el usuario que la hizo. Solo corrigen los
// Gerentes (permiso `asistencia.corregir`); el Admin no lo tiene y un Gerente no
// puede corregir sus propios registros. Un `tipo` distinto al de una entrada es
// un CIERRE ADMINISTRATIVO y solo vale sobre una entrada abierta.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { filtroAlcanceAsistencia, type ActorAsistencia } from '../../domain/rules/alcance';
import {
  cierrePosteriorAEntrada,
  correccionFutura,
  esCierreAdministrativo,
  permiteCorreccion,
} from '../../domain/rules/correccion';
import { derivarAsistencia } from '../../domain/rules/registros-efectivos';
import {
  AttendanceRepository,
  type RegistroRespuesta,
} from '../../infrastructure/attendance.repository';
import type { TipoMarcaje } from './marcar-asistencia.use-case';

export type CorregirRegistroComando = {
  motivo: string;
  fechaHora: Date;
  tipo?: TipoMarcaje;
};

@Injectable()
export class CorregirRegistroUseCase {
  constructor(private readonly repository: AttendanceRepository) {}

  async ejecutar(
    actor: ActorAsistencia,
    id: string,
    comando: CorregirRegistroComando,
  ): Promise<RegistroRespuesta> {
    return this.repository.enTransaccion(async (cliente) => {
      const conEmpleado = await this.repository.buscarRegistroEnAlcance(
        id,
        filtroAlcanceAsistencia(actor),
        cliente,
      );
      if (conEmpleado === null) {
        throw new NotFoundException('Registro no encontrado');
      }

      const { registro, empleado } = conEmpleado;

      if (registro.esCorreccion) {
        throw new BadRequestException(
          'Solo se pueden corregir registros originales',
        );
      }

      await this.repository.bloquearEmpleado(registro.empleadoId, cliente);

      const tipoCorreccion = comando.tipo ?? registro.tipo;

      if (!permiteCorreccion(registro.tipo, tipoCorreccion)) {
        throw new BadRequestException(
          'El tipo de la correccion no es valido para este registro',
        );
      }

      if (correccionFutura(comando.fechaHora, new Date())) {
        throw new BadRequestException(
          'La fecha de la correccion no puede ser futura',
        );
      }

      if (comando.motivo.trim() === '') {
        throw new BadRequestException('El motivo no puede estar vacio');
      }

      if (empleado.usuarioId === actor.id) {
        throw new ForbiddenException(
          'No puedes corregir tus propios registros',
        );
      }

      const parYaExiste = await this.repository.existeParCorreccion(
        registro.id,
        tipoCorreccion,
        cliente,
      );
      if (parYaExiste) {
        throw new ConflictException(
          'Ya existe una correccion de ese tipo para este registro',
        );
      }

      if (esCierreAdministrativo(registro.tipo, tipoCorreccion)) {
        const historial = await this.repository.listarRegistrosDeEmpleado(
          registro.empleadoId,
          cliente,
        );
        const derivacion = derivarAsistencia(historial);
        const derivado = derivacion.registros.find(
          (item) => item.id === registro.id,
        );

        if (derivado === undefined || !derivado.abierta) {
          throw new ConflictException('Esa entrada ya esta cerrada');
        }

        if (!cierrePosteriorAEntrada(derivado.fechaHora, comando.fechaHora)) {
          throw new BadRequestException(
            'El cierre debe ser posterior a la entrada',
          );
        }
      }

      return this.repository.crearRegistro(
        {
          empleadoId: registro.empleadoId,
          sucursalId: registro.sucursalId,
          tipo: tipoCorreccion,
          fechaHora: comando.fechaHora,
          metodo: 'correccion',
          esCorreccion: true,
          registroOriginalId: registro.id,
          motivo: comando.motivo,
          usuarioCorrectorId: actor.id,
        },
        cliente,
      );
    });
  }
}