export const inputClass =
  'min-h-11 w-full rounded-lg border bg-card px-3 text-sm aria-[invalid=true]:border-destructive';

export interface FieldA11yProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

export function fieldA11y(id: string, error?: string, hint?: string): FieldA11yProps {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
}
