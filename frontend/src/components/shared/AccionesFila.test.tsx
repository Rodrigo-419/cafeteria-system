import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AccionesFila } from './AccionesFila'

describe('AccionesFila', () => {
  it('pinta la acción principal y esconde las destructivas tras el menú', async () => {
    const user = userEvent.setup()
    render(
      <AccionesFila
        principal={<button type="button">Ver</button>}
        acciones={[
          { etiqueta: 'Anular', destructiva: true, onSelect: () => {} },
        ]}
      />,
    )

    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Anular' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Anular' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Más acciones' }))

    expect(
      await screen.findByRole('menuitem', { name: 'Anular' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Anular' }),
    ).not.toBeInTheDocument()
  })

  it('pide confirmación integrada antes de ejecutar la acción', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AccionesFila
        acciones={[
          {
            etiqueta: 'Eliminar',
            destructiva: true,
            onSelect,
            confirmacion: {
              titulo: 'Eliminar registro',
              descripcion: 'Esta acción no se puede deshacer.',
              textoConfirmar: 'Sí, eliminar',
            },
          },
        ]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Más acciones' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Eliminar' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(
      screen.getByText('Esta acción no se puede deshacer.'),
    ).toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: 'Sí, eliminar' }),
    )

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(dialogo).not.toBeInTheDocument()
  })

  it('no pinta nada si no hay acciones', () => {
    const { container } = render(<AccionesFila />)

    expect(container).toBeEmptyDOMElement()
  })
})
