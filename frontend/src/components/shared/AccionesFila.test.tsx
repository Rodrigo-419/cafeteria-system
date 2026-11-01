import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrashIcon } from 'lucide-react'
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

  it('muestra una única acción secundaria con icono como botón directo', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AccionesFila
        principal={<button type="button">Ver</button>}
        acciones={[
          {
            etiqueta: 'Eliminar',
            icono: <TrashIcon />,
            destructiva: true,
            onSelect,
          },
        ]}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Más acciones' }),
    ).not.toBeInTheDocument()
    const boton = screen.getByRole('button', { name: 'Eliminar' })
    expect(boton).toHaveAttribute('title', 'Eliminar')
    expect(boton).toHaveClass('text-muted-foreground')
    expect(boton).not.toHaveClass('text-destructive')

    await user.click(boton)

    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('usa la confirmación integrada en el botón directo', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AccionesFila
        acciones={[
          {
            etiqueta: 'Eliminar',
            icono: <TrashIcon />,
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

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(
      screen.getByText('Esta acción no se puede deshacer.'),
    ).toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(dialogo).not.toBeInTheDocument()
  })

  it('mantiene el menú cuando hay dos acciones secundarias', async () => {
    const user = userEvent.setup()
    render(
      <AccionesFila
        acciones={[
          { etiqueta: 'Permisos', onSelect: () => {} },
          { etiqueta: 'Bloquear', destructiva: true, onSelect: () => {} },
        ]}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Más acciones' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Permisos' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Permisos' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Más acciones' }))

    expect(
      await screen.findByRole('menuitem', { name: 'Permisos' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: 'Bloquear' }),
    ).toBeInTheDocument()
  })

  it('mantiene el menú si la única acción no tiene icono', () => {
    render(
      <AccionesFila
        acciones={[
          { etiqueta: 'Anular', destructiva: true, onSelect: () => {} },
        ]}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Más acciones' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Anular' }),
    ).not.toBeInTheDocument()
  })

  it('no pinta nada si no hay acciones', () => {
    const { container } = render(<AccionesFila />)

    expect(container).toBeEmptyDOMElement()
  })
})
