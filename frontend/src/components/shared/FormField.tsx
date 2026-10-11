import type { ReactNode } from 'react'
import {
  Controller,
  type Control,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  type UseFormStateReturn,
} from 'react-hook-form'
import {
  FormControl,
  FormDescription,
  FormField as RHFField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { cn } from 'cn'

interface FormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>
  name: TName
  label?: string
  description?: string
  render: (props: {
    field: ControllerRenderProps<TFieldValues, TName>
    fieldState: ControllerFieldState
    formState: UseFormStateReturn<TFieldValues>
  }) => ReactNode
  className?: string
}

export function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(props: FormFieldProps<TFieldValues, TName>) {
  return (
    <RHFField
      control={props.control}
      name={props.name}
      render={({ field, fieldState, formState }) => (
        <FormItem className={cn(props.className)}>
          {props.label && <FormLabel>{props.label}</FormLabel>}
          <FormControl>
            {props.render({ field, fieldState, formState })}
          </FormControl>
          {props.description && (
            <FormDescription>{props.description}</FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export { Controller }
