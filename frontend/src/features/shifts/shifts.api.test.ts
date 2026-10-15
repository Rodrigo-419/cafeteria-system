import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import {
  actualizarTurno,
  crearTurno,
  listarTurnos,
  obtenerTurno,
} from '@/lib/api/shifts'
import {
  crearAsignacion,
  listarAsignaciones,
  retirarAsignacion,
} from '@/lib/api/assignments'
import { crearEmpleado } from '@/lib/api/employees'
import { diaDeNegocioLima } from '@/lib/format/dates'
import { iniciarSesionDePrueba } from '@/test/render'
import {
  PERMISOS_ADMIN,
  PERMISOS_GERENTE,
  usuarioDePrueba,
} from '@/test/handlers'
import { lunesDeSemana, sumarDias } from './semana'

function sesionAdmin() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
  )
}

function sesionGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
}

async function capturar(promesa: Promise<unknown>): Promise<ApiError> {
  try {
    await promesa
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('Se esperaba un ApiError')
}

/** Problemas de negocio que Nest adjunta en `problemas`. */
function problemasDe(error: ApiError): string[] {
  const cuerpo = error.cuerpo as { problemas?: string[] } | undefined
  return cuerpo?.problemas ?? []
}

describe('Contratos de la API de turnos', () => {
  it('el Admin lista los turnos de todas las sucursales', async () => {
    sesionAdmin()
    const pagina = await listarTurnos({ page: 1, limit: 100 })

    expect(pagina.total).toBe(3)
    expect(pagina.data.map((turno) => turno.id)).toContain('turno-3')
  })

  it('el Gerente solo ve los turnos de su sucursal', async () => {
    sesionGerente()
    const pagina = await listarTurnos({ page: 1, limit: 100 })

    expect(pagina.total).toBe(2)
    expect(pagina.data.every((turno) => turno.sucursalId === 'sucursal-1')).toBe(
      true,
    )
  })

  it('devuelve 404 al pedir un turno fuera del alcance (Gerente)', async () => {
    sesionGerente()
    const error = await capturar(obtenerTurno('turno-3'))

    expect(error.status).toBe(404)
  })

  it('crea un turno fijo y guarda los días en forma canónica', async () => {
    sesionAdmin()
    const turno = await crearTurno({
      sucursalId: 'sucursal-1',
      tipo: 'fijo',
      horaInicio: '08:00',
      horaFin: '12:00',
      diasSemana: '1, 3, 5',
    })

    expect(turno.tipo).toBe('fijo')
    expect(turno.diasSemana).toBe('1,3,5')
    expect(turno.horaInicio).toBe('08:00')
  })

  it('rechaza unos días fuera de orden ascendente (400)', async () => {
    sesionAdmin()
    const error = await capturar(
      crearTurno({
        sucursalId: 'sucursal-1',
        tipo: 'fijo',
        horaInicio: '08:00',
        horaFin: '12:00',
        diasSemana: '5,1,3',
      }),
    )

    expect(error.status).toBe(400)
    expect(problemasDe(error)).toContain(
      'Los dias de la semana deben venir en orden ascendente',
    )
  })

  it('el Gerente crea siempre en su sucursal aunque envíe otra', async () => {
    sesionGerente()
    const turno = await crearTurno({
      sucursalId: 'sucursal-2',
      tipo: 'variable',
    })

    expect(turno.sucursalId).toBe('sucursal-1')
    expect(turno.horaInicio).toBeNull()
  })

  it('rechaza un turno fijo sin días (400 con problemas)', async () => {
    sesionAdmin()
    const error = await capturar(
      crearTurno({
        sucursalId: 'sucursal-1',
        tipo: 'fijo',
        horaInicio: '08:00',
        horaFin: '12:00',
      }),
    )

    expect(error.status).toBe(400)
    expect(error.mensajes[0]).toBe('Los dias del turno no son validos')
    expect(problemasDe(error)).toContain(
      'Un turno fijo debe indicar los dias de la semana',
    )
  })

  it('rechaza un turno fijo sin hora de fin (400 con problemas)', async () => {
    sesionAdmin()
    const error = await capturar(
      crearTurno({
        sucursalId: 'sucursal-1',
        tipo: 'fijo',
        horaInicio: '08:00',
        diasSemana: '1,2',
      }),
    )

    expect(error.status).toBe(400)
    expect(error.mensajes[0]).toBe('El horario del turno no es valido')
    expect(problemasDe(error)).toContain(
      'Un turno fijo debe tener hora de inicio y de fin',
    )
  })

  it('rechaza un Admin que no indica la sucursal (400)', async () => {
    sesionAdmin()
    const error = await capturar(crearTurno({ tipo: 'variable' }))

    expect(error.status).toBe(400)
  })

  it('rechaza una sucursal inexistente (404)', async () => {
    sesionAdmin()
    const error = await capturar(
      crearTurno({ sucursalId: 'sucursal-9', tipo: 'variable' }),
    )

    expect(error.status).toBe(404)
  })

  it('rechaza una edición sin cambios (400)', async () => {
    sesionAdmin()
    const error = await capturar(actualizarTurno('turno-1', {}))

    expect(error.status).toBe(400)
  })

  it('edita las horas de un turno', async () => {
    sesionAdmin()
    const turno = await actualizarTurno('turno-1', {
      horaInicio: '06:00',
      horaFin: '15:00',
    })

    expect(turno.horaInicio).toBe('06:00')
    expect(turno.horaFin).toBe('15:00')
  })

  it('devuelve 404 al editar un turno fuera del alcance (Gerente)', async () => {
    sesionGerente()
    const error = await capturar(
      actualizarTurno('turno-3', { horaInicio: '08:00', horaFin: '12:00' }),
    )

    expect(error.status).toBe(404)
  })
})

describe('Contratos de la API de asignaciones', () => {
  it('el Admin lista las asignaciones de todas las sucursales', async () => {
    sesionAdmin()
    const pagina = await listarAsignaciones({ page: 1, limit: 100 })

    expect(pagina.total).toBe(3)
    expect(pagina.data.map((item) => item.id)).toContain('asignacion-3')
  })

  it('el Gerente solo ve las asignaciones de su sucursal', async () => {
    sesionGerente()
    const pagina = await listarAsignaciones({ page: 1, limit: 100 })

    expect(pagina.total).toBe(2)
    expect(
      pagina.data.every((item) => item.empleado.sucursalId === 'sucursal-1'),
    ).toBe(true)
  })

  it('crea una asignación para un empleado activo (201)', async () => {
    sesionAdmin()
    const empleado = await crearEmpleado({
      usuarioId: 'usuario-4',
      cargo: 'Barista',
      fechaContratacion: '2026-01-01',
    })
    const asignacion = await crearAsignacion({
      empleadoId: empleado.id,
      turnoId: 'turno-1',
      fechaInicio: '2026-03-01',
    })

    expect(asignacion.empleado.usuario.nombre).toBe('Dora Nueva')
    expect(asignacion.fechaFin).toBeNull()
  })

  it('rechaza asignar a un empleado cesado (409)', async () => {
    sesionAdmin()
    const error = await capturar(
      crearAsignacion({
        empleadoId: 'empleado-3',
        turnoId: 'turno-3',
        fechaInicio: '2026-03-01',
      }),
    )

    expect(error.status).toBe(409)
  })

  it('rechaza un turno de otra sucursal (404)', async () => {
    sesionAdmin()
    const error = await capturar(
      crearAsignacion({
        empleadoId: 'empleado-2',
        turnoId: 'turno-3',
        fechaInicio: '2026-03-01',
      }),
    )

    expect(error.status).toBe(404)
  })

  it('rechaza un solapamiento con otra asignación del mismo empleado (409)', async () => {
    sesionAdmin()
    const error = await capturar(
      crearAsignacion({
        empleadoId: 'empleado-2',
        turnoId: 'turno-1',
        fechaInicio: '2026-03-01',
      }),
    )

    expect(error.status).toBe(409)
    expect(error.mensajes[0]).toBe(
      'El empleado ya tiene una asignacion que se solapa',
    )
  })

  it('rechaza una fecha de inicio anterior a la contratación (400)', async () => {
    sesionAdmin()
    const error = await capturar(
      crearAsignacion({
        empleadoId: 'empleado-2',
        turnoId: 'turno-1',
        fechaInicio: '2026-01-15',
      }),
    )

    expect(error.status).toBe(400)
  })

  it('retira una asignación fijando su fecha de fin', async () => {
    sesionAdmin()
    const hoy = diaDeNegocioLima(new Date())
    const retirada = await retirarAsignacion('asignacion-2', { fechaFin: hoy })

    expect(retirada.fechaFin).toBe(hoy)
  })

  it('rechaza una fecha de retiro anterior a hoy (400)', async () => {
    sesionAdmin()
    const hoy = diaDeNegocioLima(new Date())
    const pasado = sumarDias(lunesDeSemana(hoy), -7)
    const error = await capturar(
      retirarAsignacion('asignacion-1', { fechaFin: pasado }),
    )

    expect(error.status).toBe(400)
    expect(error.mensajes[0]).toBe('La fecha de fin no puede ser anterior a hoy')
  })

  it('devuelve 404 al retirar una asignación inexistente', async () => {
    sesionAdmin()
    const error = await capturar(
      retirarAsignacion('asignacion-99', { fechaFin: '2026-03-01' }),
    )

    expect(error.status).toBe(404)
  })
})
