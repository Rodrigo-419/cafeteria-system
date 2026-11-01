import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DataTable, type Column } from './DataTable'

interface Fila {
  id: string
  nombre: string
}

const columnas: Column<Fila>[] = [
  { key: 'nombre', header: 'Nombre', cell: (fila) => fila.nombre },
]

const filas: Fila[] = [
  { id: '1', nombre: 'Café americano' },
  { id: '2', nombre: 'Té verde' },
]

describe('DataTable', () => {
  it('muestra esqueletos durante la carga', () => {
    render(<DataTable columns={columnas} data={[]} isLoading />)

    expect(screen.queryByText('Sin datos')).not.toBeInTheDocument()
    expect(screen.queryByText('Nombre')).not.toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay datos', () => {
    render(
      <DataTable columns={columnas} data={[]} emptyTitle="Nada por aquí" />,
    )

    expect(screen.getByText('Nada por aquí')).toBeInTheDocument()
  })

  it('muestra el estado de error y permite reintentar', async () => {
    const onRetry = vi.fn()
    render(
      <DataTable
        columns={columnas}
        data={[]}
        error="Falla de red"
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText('Error al cargar datos')).toBeInTheDocument()
    expect(screen.getByText('Falla de red')).toBeInTheDocument()

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /reintentar/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renderiza las filas con las celdas de cada columna', () => {
    render(<DataTable columns={columnas} data={filas} />)

    expect(screen.getByText('Nombre')).toBeInTheDocument()
    expect(screen.getByText('Café americano')).toBeInTheDocument()
    expect(screen.getByText('Té verde')).toBeInTheDocument()
  })

  it('muestra paginación y cambia de página', async () => {
    const onPageChange = vi.fn()
    render(
      <DataTable
        columns={columnas}
        data={filas}
        page={1}
        pageSize={10}
        total={25}
        onPageChange={onPageChange}
      />,
    )

    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled()

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /siguiente/i }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('invoca onFilaClick con la fila pulsada', async () => {
    const onFilaClick = vi.fn()
    render(
      <DataTable columns={columnas} data={filas} onFilaClick={onFilaClick} />,
    )

    const fila = screen.getByText('Té verde').closest('tr')
    expect(fila).not.toBeNull()
    await userEvent.setup().click(screen.getByText('Té verde'))

    expect(onFilaClick).toHaveBeenCalledTimes(1)
    expect(onFilaClick).toHaveBeenCalledWith(filas[1])
    expect(fila).toHaveClass('cursor-pointer')
    expect(fila).not.toHaveAttribute('role')
    expect(fila).not.toHaveAttribute('tabindex')
  })

  it('no hace nada al pulsar una fila si no se pasa onFilaClick', async () => {
    render(<DataTable columns={columnas} data={filas} />)
    const user = userEvent.setup()

    const fila = screen.getByText('Té verde').closest('tr')
    expect(fila).not.toBeNull()
    expect(fila).not.toHaveClass('cursor-pointer')

    await user.click(screen.getByText('Té verde'))

    expect(fila).not.toHaveClass('cursor-pointer')
    expect(fila).not.toHaveAttribute('role')
    expect(fila).not.toHaveAttribute('tabindex')
  })
})
