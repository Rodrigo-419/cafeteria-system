// Diálogo para asignar un turno a un empleado. Se monta solo cuando está
// abierto, así su estado interno se reinicia en cada apertura.
//
// El empleado se elige primero y el turno se ofrece de su misma sucursal (el
// backend responde 404 si no coinciden). Solo se ofrecen empleados activos: un
// empleado cesado no puede recibir turnos (el backend responde 409). La fecha de
// inicio no puede ser anterior a la contratación y la de fin, opcional, no puede
// ser anterior a la de inicio.
//
// La validación aquí es una ayuda: el backend sigue siendo la autoridad y sus
// errores (400/403/404/409, incluido el solapamiento) se muestran con
// `mensajeDeError`.
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { diaDeNegocioLima } from '@/lib/format/dates'
import { LIMITE_LISTA, useCrearAsignacion, useTurnosDeSucursal } from './queries'
import { useEmpleados } from '@/features/employees/queries'
import { mensajeDeError } from './mensajes'
import {
  ETIQUETA_TIPO_TURNO,
  formatearHorario,
  mensajeFechaFin,
  mensajeFechaInicioContratacion,
} from './presentacion'

interface AsignacionDialogProps {
  onClose: () => void
}

export function AsignacionDialog({ onClose }: AsignacionDialogProps) {
  const [empleadoId, setEmpleadoId] = useState('')
  const [turnoId, setTurnoId] = useState('')
  const [fechaInicio, setFechaInicio] = useState(diaDeNegocioLima(new Date()))
  const [fechaFin, setFechaFin] = useState('')
  const [error, setError] = useState<string | null>(null)

  const empleados = useEmpleados({ page: 1, limit: LIMITE_LISTA, estado: 'activo' })
  const empleadoSeleccionado = useMemo(
    () => (empleados.data?.data ?? []).find((empleado) => empleado.id === empleadoId),
    [empleados.data, empleadoId],
  )

  const turnos = useTurnosDeSucursal(empleadoSeleccionado?.sucursalId ?? null)
  const crear = useCrearAsignacion()

  const problemaInicio = empleadoSeleccionado
    ? mensajeFechaInicioContratacion(
        empleadoSeleccionado.fechaContratacion,
        fechaInicio,
      )
    : fechaInicio === ''
      ? 'La fecha de inicio es obligatoria.'
      : null
  const problemaFin = mensajeFechaFin(fechaInicio, fechaFin)
  const valido =
    empleadoId !== '' &&
    turnoId !== '' &&
    problemaInicio === null &&
    problemaFin === null

  function guardar() {
    if (!valido) return
    setError(null)
    crear.mutate(
      {
        empleadoId,
        turnoId,
        fechaInicio,
        ...(fechaFin !== '' ? { fechaFin } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Turno asignado')
          onClose()
        },
        onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'asignar')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar turno</DialogTitle>
          <DialogDescription>
            El turno debe ser de la misma sucursal que el empleado. La fecha de
            inicio no puede ser anterior a su contratación.
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-asignacion"
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="asignacion-empleado">Empleado</Label>
            <Select
              value={empleadoId}
              onValueChange={(valor) => {
                setEmpleadoId(valor)
                setTurnoId('')
              }}
            >
              <SelectTrigger id="asignacion-empleado">
                <SelectValue placeholder="Selecciona un empleado" />
              </SelectTrigger>
              <SelectContent>
                {(empleados.data?.data ?? []).length === 0 ? (
                  <SelectItem value="__vacio__" disabled>
                    No hay empleados activos
                  </SelectItem>
                ) : (
                  (empleados.data?.data ?? []).map((empleado) => (
                    <SelectItem key={empleado.id} value={empleado.id}>
                      {empleado.usuario.nombre} · {empleado.cargo}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asignacion-turno">Turno</Label>
            <Select
              value={turnoId}
              onValueChange={setTurnoId}
              disabled={empleadoSeleccionado === undefined}
            >
              <SelectTrigger id="asignacion-turno">
                <SelectValue
                  placeholder={
                    empleadoSeleccionado
                      ? 'Selecciona un turno'
                      : 'Elige primero un empleado'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(turnos.data?.data ?? []).length === 0 ? (
                  <SelectItem value="__vacio__" disabled>
                    No hay turnos en la sucursal del empleado
                  </SelectItem>
                ) : (
                  (turnos.data?.data ?? []).map((turno) => (
                    <SelectItem key={turno.id} value={turno.id}>
                      {ETIQUETA_TIPO_TURNO[turno.tipo]} ·{' '}
                      {formatearHorario(turno.horaInicio, turno.horaFin)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asignacion-inicio">Fecha de inicio</Label>
            <Input
              id="asignacion-inicio"
              type="date"
              value={fechaInicio}
              onChange={(evento) => setFechaInicio(evento.target.value)}
            />
            {problemaInicio && (
              <p className="text-xs text-destructive">{problemaInicio}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="asignacion-fin">Fecha de fin (opcional)</Label>
            <Input
              id="asignacion-fin"
              type="date"
              value={fechaFin}
              onChange={(evento) => setFechaFin(evento.target.value)}
            />
            {problemaFin && (
              <p className="text-xs text-destructive">{problemaFin}</p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo asignar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={crear.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-asignacion"
            disabled={crear.isPending || !valido}
          >
            {crear.isPending ? 'Asignando…' : 'Asignar turno'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
