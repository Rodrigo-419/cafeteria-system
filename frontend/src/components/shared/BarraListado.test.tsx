import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BarraListado } from './BarraListado'

describe('BarraListado', () => {
  it('pliega los filtros y muestra el contador de activos', async () => {
    const user = userEvent.setup()
    render(
      <BarraListado
        busqueda={{ value: '', onChange: () => {}, placeholder: 'Buscar…' }}
        filtros={<label htmlFor="filtro-estado">Estado</label>}
        filtrosActivos={2}
      />,
    )

    expect(
      screen.getByRole('button', { name: /Filtros/ }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.getByLabelText('2 filtros activos'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('group', { name: 'Filtros del listado' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Filtros/ }))

    expect(
      screen.getByRole('button', { name: /Filtros/ }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('group', { name: 'Filtros del listado' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Estado')).toBeInTheDocument()
  })

  it('no pinta el contador cuando no hay filtros activos', () => {
    render(
      <BarraListado
        filtros={<span>Filtro</span>}
        filtrosActivos={0}
      />,
    )

    expect(screen.queryByLabelText(/filtros activos/)).not.toBeInTheDocument()
  })

  it('propaga la búsqueda al cambiar el campo', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BarraListado busqueda={{ value: '', onChange }} />)

    await user.type(screen.getByLabelText('Buscar'), 'a')

    expect(onChange).toHaveBeenCalledWith('a')
  })
})
