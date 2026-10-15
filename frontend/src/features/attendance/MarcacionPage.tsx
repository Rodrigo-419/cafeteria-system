// Pantalla de marcación del terminal (G1).
//
// Es una vista a pantalla completa, pensada para un dispositivo compartido en la
// sucursal: se elige al colaborador, se pulsa Entrada o Salida y se teclea el PIN
// de 6 dígitos. La hora la fija SIEMPRE el servidor; aquí solo se confirma.
//
// El PIN es efímero por diseño: vive en el estado local del componente, nunca se
// guarda en caché, `sessionStorage`, `localStorage`, la URL ni los logs, y se
// borra al enviar (con éxito o error) y al desmontar. La ventana de fallos y el
// bloqueo por intentos los aplica el backend (429).
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleCheckBigIcon,
  DeleteIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  LogInIcon,
  LogOutIcon,
  SearchIcon,
  UserIcon,
} from 'lucide-react'
import { cn } from 'cn'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TerminalLayout } from '@/components/layout/TerminalLayout'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusPill } from '@/components/shared/StatusPill'
import { useAuth } from '@/lib/auth/useAuth'
import { formatearHora } from '@/lib/format/dates'
import { mensajeDeError } from '@/features/attendance/mensajes'
import {
  etiquetaTipo,
  TIPOS_MARCAJE,
  tonoTipo,
} from '@/features/attendance/presentacion'
import {
  useEmpleadosTerminal,
  useMarcarAsistencia,
} from '@/features/attendance/queries'
import type {
  EmpleadoTerminalApi,
  RegistroMarcajeApi,
  TipoMarcaje,
} from '@/types/api'

const LONGITUD_PIN = 6
const MS_VUELTA_AL_LISTADO = 2500

const TECLAS_NUMERICAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

type MarcaExitosa = RegistroMarcajeApi & { nombre: string }

export function MarcacionPage() {
  const [busqueda, setBusqueda] = useState('')
  const [empleado, setEmpleado] = useState<EmpleadoTerminalApi | null>(null)
  const [tipo, setTipo] = useState<TipoMarcaje>('entrada')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<MarcaExitosa | null>(null)

  const { usuario } = useAuth()
  const empleados = useEmpleadosTerminal()
  const marcar = useMarcarAsistencia()

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    const lista = empleados.data ?? []
    if (texto === '') return lista
    return lista.filter((item) => item.nombre.toLowerCase().includes(texto))
  }, [empleados.data, busqueda])

  const volverAListado = useCallback(() => {
    setEmpleado(null)
    setTipo('entrada')
    setPin('')
    setError(null)
    setExito(null)
    setBusqueda('')
  }, [])

  const seleccionar = useCallback((seleccionado: EmpleadoTerminalApi) => {
    setEmpleado(seleccionado)
    setTipo('entrada')
    setPin('')
    setError(null)
    setExito(null)
  }, [])

  const agregarDigito = useCallback((digito: string) => {
    setError(null)
    setPin((actual) =>
      actual.length >= LONGITUD_PIN ? actual : actual + digito,
    )
  }, [])

  const borrarDigito = useCallback(() => {
    setError(null)
    setPin((actual) => actual.slice(0, -1))
  }, [])

  const limpiarPin = useCallback(() => {
    setError(null)
    setPin('')
  }, [])

  const enviar = useCallback(() => {
    if (!empleado || pin.length !== LONGITUD_PIN || marcar.isPending) return
    setError(null)
    const nombre = empleado.nombre
    marcar.mutate(
      { empleadoId: empleado.id, tipo, pin },
      {
        onSuccess: (registro) => {
          setPin('')
          setExito({ ...registro, nombre })
        },
        onError: (fallo) => {
          // El PIN nunca se reintenta solo: se limpia y el usuario teclea de nuevo.
          setPin('')
          setError(mensajeDeError(fallo, 'marcar'))
        },
      },
    )
  }, [empleado, marcar, pin, tipo])

  // Vuelve sola al listado tras confirmar, para que el siguiente colaborador
  // pueda marcar sin dejar la pantalla en el resultado anterior.
  useEffect(() => {
    if (!exito) return
    const temporizador = setTimeout(volverAListado, MS_VUELTA_AL_LISTADO)
    return () => clearTimeout(temporizador)
  }, [exito, volverAListado])

  // Teclado físico: dígitos, borrar, Enter para enviar y Escape para volver.
  useEffect(() => {
    if (!empleado && !exito) return
    function alPulsarTecla(evento: KeyboardEvent) {
      if (exito) return
      if (evento.key >= '0' && evento.key <= '9') {
        evento.preventDefault()
        agregarDigito(evento.key)
      } else if (evento.key === 'Backspace') {
        evento.preventDefault()
        borrarDigito()
      } else if (evento.key === 'Enter') {
        evento.preventDefault()
        enviar()
      } else if (evento.key === 'Escape') {
        evento.preventDefault()
        volverAListado()
      }
    }
    window.addEventListener('keydown', alPulsarTecla)
    return () => window.removeEventListener('keydown', alPulsarTecla)
  }, [agregarDigito, borrarDigito, empleado, enviar, exito, volverAListado])

  // Marcar exige una sucursal: una cuenta sin ella (p. ej. el Admin) nunca ve el
  // terminal, solo un aviso claro. El backend respondería 403 si se intentara.
  if (usuario && usuario.sucursalId === null) {
    return (
      <TerminalLayout>
        <header className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRoundIcon className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Registrar asistencia
          </h1>
        </header>
        <ErrorState
          title="El terminal no está disponible"
          description="Tu cuenta no tiene una sucursal asignada para marcar asistencia."
        />
      </TerminalLayout>
    )
  }

  return (
    <TerminalLayout>
      <header className="text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KeyRoundIcon className="size-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Registrar asistencia
        </h1>
        <p className="text-sm text-muted-foreground">
          Marca tu entrada o salida con el PIN de 6 dígitos.
        </p>
      </header>

      {empleados.isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            Cargando colaboradores…
          </CardContent>
        </Card>
      ) : empleados.error ? (
        <ErrorState
          title="No se pudo cargar el terminal"
          description={mensajeDeError(empleados.error, 'terminal')}
          onRetry={() => void empleados.refetch()}
        />
      ) : exito ? (
        <VistaExito marca={exito} onVolver={volverAListado} />
      ) : empleado ? (
        <VistaTeclado
          empleado={empleado}
          tipo={tipo}
          pin={pin}
          error={error}
          enviando={marcar.isPending}
          onCambiarTipo={(nuevo) => {
            setTipo(nuevo)
            setError(null)
          }}
          onDigito={agregarDigito}
          onBorrar={borrarDigito}
          onLimpiar={limpiarPin}
          onEnviar={enviar}
          onVolver={volverAListado}
        />
      ) : (
        <VistaSeleccion
          busqueda={busqueda}
          filtrados={filtrados}
          hayEmpleados={(empleados.data ?? []).length > 0}
          onBuscar={setBusqueda}
          onSeleccionar={seleccionar}
        />
      )}
    </TerminalLayout>
  )
}

function VistaSeleccion({
  busqueda,
  filtrados,
  hayEmpleados,
  onBuscar,
  onSeleccionar,
}: {
  busqueda: string
  filtrados: EmpleadoTerminalApi[]
  hayEmpleados: boolean
  onBuscar: (valor: string) => void
  onSeleccionar: (empleado: EmpleadoTerminalApi) => void
}) {
  if (!hayEmpleados) {
    return (
      <EmptyState
        title="Sin colaboradores"
        description="No hay colaboradores activos en esta sucursal para marcar asistencia."
      />
    )
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar colaborador"
            placeholder="Buscar colaborador…"
            className="pl-9"
            value={busqueda}
            onChange={(evento) => onBuscar(evento.target.value)}
          />
        </div>
        {filtrados.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay colaboradores que coincidan con la búsqueda.
          </p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {filtrados.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSeleccionar(item)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-muted text-primary">
                    <UserIcon className="size-4" />
                  </span>
                  <span className="font-medium">{item.nombre}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

interface VistaTecladoProps {
  empleado: EmpleadoTerminalApi
  tipo: TipoMarcaje
  pin: string
  error: string | null
  enviando: boolean
  onCambiarTipo: (tipo: TipoMarcaje) => void
  onDigito: (digito: string) => void
  onBorrar: () => void
  onLimpiar: () => void
  onEnviar: () => void
  onVolver: () => void
}

function VistaTeclado({
  empleado,
  tipo,
  pin,
  error,
  enviando,
  onCambiarTipo,
  onDigito,
  onBorrar,
  onLimpiar,
  onEnviar,
  onVolver,
}: VistaTecladoProps) {
  const listo = pin.length === LONGITUD_PIN

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Volver al listado"
            onClick={onVolver}
            disabled={enviando}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <span className="flex size-8 items-center justify-center rounded-full bg-muted text-primary">
            <UserIcon className="size-4" />
          </span>
          <span className="font-medium">{empleado.nombre}</span>
        </div>

        <div
          role="group"
          aria-label="Tipo de marcaje"
          className="grid grid-cols-2 gap-2"
        >
          {TIPOS_MARCAJE.map((opcion) => (
            <Button
              key={opcion}
              type="button"
              variant={tipo === opcion ? 'default' : 'outline'}
              aria-pressed={tipo === opcion}
              onClick={() => onCambiarTipo(opcion)}
              disabled={enviando}
            >
              {opcion === 'entrada' ? (
                <LogInIcon className="size-4" />
              ) : (
                <LogOutIcon className="size-4" />
              )}
              {etiquetaTipo(opcion)}
            </Button>
          ))}
        </div>

        <div
          className="flex justify-center gap-3"
          aria-label={`PIN: ${pin.length} de ${LONGITUD_PIN} dígitos`}
        >
          {Array.from({ length: LONGITUD_PIN }).map((_, indice) => (
            <span
              key={indice}
              aria-hidden
              className={cn(
                'size-3.5 rounded-full transition-colors',
                indice < pin.length ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-3 gap-2">
          {TECLAS_NUMERICAS.map((tecla) => (
            <Button
              key={tecla}
              type="button"
              variant="secondary"
              className="h-12 text-lg"
              onClick={() => onDigito(tecla)}
              disabled={enviando}
            >
              {tecla}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            className="h-12"
            onClick={onLimpiar}
            disabled={enviando || pin.length === 0}
          >
            Limpiar
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-12 text-lg"
            onClick={() => onDigito('0')}
            disabled={enviando}
          >
            0
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-12"
            aria-label="Borrar último dígito"
            onClick={onBorrar}
            disabled={enviando || pin.length === 0}
          >
            <DeleteIcon className="size-5" />
          </Button>
        </div>

        <Button
          type="button"
          className="w-full"
          onClick={onEnviar}
          disabled={!listo || enviando}
        >
          {enviando ? (
            <LoaderCircleIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          {`Registrar ${etiquetaTipo(tipo).toLowerCase()}`}
        </Button>
      </CardContent>
    </Card>
  )
}

function VistaExito({
  marca,
  onVolver,
}: {
  marca: MarcaExitosa
  onVolver: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 text-center">
        <CircleCheckBigIcon className="size-12 text-success" />
        <div className="space-y-1">
          <p className="text-lg font-semibold">{marca.nombre}</p>
          <StatusPill tono={tonoTipo(marca.tipo)}>
            {etiquetaTipo(marca.tipo)}
          </StatusPill>
        </div>
        <p className="text-3xl font-bold tabular-nums">
          {formatearHora(marca.fechaHora)}
        </p>
        <Button type="button" className="w-full" onClick={onVolver}>
          Listo
        </Button>
        <p className="text-xs text-muted-foreground">
          Volviendo al listado…
        </p>
      </CardContent>
    </Card>
  )
}
