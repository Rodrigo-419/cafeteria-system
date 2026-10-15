// Diálogo de alta y edición de turnos. Se monta solo cuando está abierto, así su
// estado interno se reinicia en cada apertura.
//
// El tipo y la sucursal solo se eligen al crear: el contrato PATCH no los
// expone, así que en edición se muestran como datos fijos. En edición se envían
// SIEMPRE las horas y los días (cadena vacía = limpiar = null), que es lo que
// permite vaciar la franja de un turno variable; un turno fijo nunca puede
// quedar sin horas ni sin días.
//
// La validación aquí es una ayuda: el backend sigue siendo la autoridad y sus
// errores (400/403/404/409) se muestran tal cual con `mensajeDeError`.
import { useState } from 'react'
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
import { useAuth } from '@/lib/auth/useAuth'
import { mensajeDeError } from './mensajes'
import {
  DIAS_SEMANA,
  ETIQUETA_TIPO_TURNO,
  mensajeDias,
  mensajeHoras,
  TIPOS_TURNO,
  diasDeTexto,
  textoDeDias,
} from './presentacion'
import { TipoTurnoBadge } from './TipoTurnoBadge'
import { useCrearTurno, useActualizarTurno, useSucursalesTurnos } from './queries'
import type { EntradaActualizarTurno, EntradaCrearTurno } from '@/lib/api/shifts'
import type { TipoTurno, TurnoApi } from '@/types/api'

interface TurnoDialogProps {
  turno?: TurnoApi | null
  onClose: () => void
}

const TIPO_POR_DEFECTO: TipoTurno = 'fijo'

export function TurnoDialog({ turno, onClose }: TurnoDialogProps) {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'Admin'
  const esEdicion = turno != null

  const [sucursalId, setSucursalId] = useState(turno?.sucursalId ?? '')
  const [tipo, setTipo] = useState<TipoTurno>(turno?.tipo ?? TIPO_POR_DEFECTO)
  const [horaInicio, setHoraInicio] = useState(turno?.horaInicio ?? '')
  const [horaFin, setHoraFin] = useState(turno?.horaFin ?? '')
  const [dias, setDias] = useState<number[]>(diasDeTexto(turno?.diasSemana ?? null))
  const [error, setError] = useState<string | null>(null)

  const sucursales = useSucursalesTurnos(esAdmin)
  const crear = useCrearTurno()
  const actualizar = useActualizarTurno()
  const pendiente = crear.isPending || actualizar.isPending

  const problemaHoras = mensajeHoras(tipo, horaInicio, horaFin)
  const problemaDias = mensajeDias(tipo, dias)
  const valido =
    problemaHoras === null &&
    problemaDias === null &&
    (esEdicion || !esAdmin || sucursalId !== '')

  function alternarDia(numero: number) {
    setDias((actuales) =>
      actuales.includes(numero)
        ? actuales.filter((dia) => dia !== numero)
        : [...actuales, numero],
    )
  }

  function guardar() {
    if (!valido) return
    setError(null)

    if (esEdicion && turno) {
      const entrada: EntradaActualizarTurno = {
        horaInicio,
        horaFin,
        diasSemana: textoDeDias(dias),
      }
      actualizar.mutate(
        { id: turno.id, entrada },
        {
          onSuccess: () => {
            toast.success('Turno actualizado')
            onClose()
          },
          onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'editar')),
        },
      )
      return
    }

    const entrada: EntradaCrearTurno = { tipo }
    if (esAdmin && sucursalId !== '') entrada.sucursalId = sucursalId
    if (horaInicio !== '') entrada.horaInicio = horaInicio
    if (horaFin !== '') entrada.horaFin = horaFin
    const textoDias = textoDeDias(dias)
    if (textoDias !== '') entrada.diasSemana = textoDias

    crear.mutate(entrada, {
      onSuccess: () => {
        toast.success('Turno creado')
        onClose()
      },
      onError: (fallo: unknown) => setError(mensajeDeError(fallo, 'crear')),
    })
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{esEdicion ? 'Editar turno' : 'Crear turno'}</DialogTitle>
          <DialogDescription>
            {esEdicion
              ? 'Solo se pueden cambiar las horas y los días. El tipo y la sucursal no se editan.'
              : tipo === 'fijo'
                ? 'Un turno fijo necesita hora de inicio, hora de fin y al menos un día.'
                : 'Un turno variable puede no tener horas ni días; se completan por asignación.'}
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-turno"
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
        >
          {esEdicion && turno ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Tipo: </span>
              <TipoTurnoBadge tipo={turno.tipo} />
            </div>
          ) : (
            <>
              {esAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="turno-sucursal">Sucursal</Label>
                  <Select value={sucursalId} onValueChange={setSucursalId}>
                    <SelectTrigger id="turno-sucursal">
                      <SelectValue placeholder="Selecciona una sucursal" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sucursales.data ?? []).map((sucursal) => (
                        <SelectItem key={sucursal.id} value={sucursal.id}>
                          {sucursal.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="turno-tipo">Tipo</Label>
                <Select
                  value={tipo}
                  onValueChange={(valor) => setTipo(valor as TipoTurno)}
                >
                  <SelectTrigger id="turno-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_TURNO.map((valor) => (
                      <SelectItem key={valor} value={valor}>
                        {ETIQUETA_TIPO_TURNO[valor]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="turno-hora-inicio">Hora de inicio</Label>
              <Input
                id="turno-hora-inicio"
                type="time"
                value={horaInicio}
                onChange={(evento) => setHoraInicio(evento.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="turno-hora-fin">Hora de fin</Label>
              <Input
                id="turno-hora-fin"
                type="time"
                value={horaFin}
                onChange={(evento) => setHoraFin(evento.target.value)}
              />
            </div>
          </div>
          {problemaHoras && (
            <p className="text-xs text-destructive">{problemaHoras}</p>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Días de la semana</legend>
            <div className="flex flex-wrap gap-3">
              {DIAS_SEMANA.map((dia) => (
                <label
                  key={dia.numero}
                  className="flex items-center gap-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input"
                    checked={dias.includes(dia.numero)}
                    onChange={() => alternarDia(dia.numero)}
                  />
                  {dia.corto}
                </label>
              ))}
            </div>
            {problemaDias && (
              <p className="text-xs text-destructive">{problemaDias}</p>
            )}
          </fieldset>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo guardar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pendiente}>
            Cancelar
          </Button>
          <Button type="submit" form="form-turno" disabled={pendiente || !valido}>
            {pendiente
              ? 'Guardando…'
              : esEdicion
                ? 'Guardar cambios'
                : 'Crear turno'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
