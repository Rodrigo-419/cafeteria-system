import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('muestra el título y la descripción cuando está abierto', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Eliminar producto"
        description="Esta acción no se puede deshacer."
        onConfirm={() => {}}
      />,
    )

    expect(screen.getByText('Eliminar producto')).toBeInTheDocument()
    expect(
      screen.getByText('Esta acción no se puede deshacer.'),
    ).toBeInTheDocument()
  })

  it('no muestra nada cuando está cerrado', () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="Eliminar producto"
        onConfirm={() => {}}
      />,
    )

    expect(screen.queryByText('Eliminar producto')).not.toBeInTheDocument()
  })

  it('llama a onConfirm al confirmar', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Confirmar acción"
        confirmText="Eliminar"
        onConfirm={onConfirm}
      />,
    )

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('llama a onCancel al cancelar', async () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Confirmar acción"
        cancelText="No, volver"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    )

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'No, volver' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('deshabilita las acciones mientras carga', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Confirmar acción"
        loading
        onConfirm={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /confirmar/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled()
  })
})
