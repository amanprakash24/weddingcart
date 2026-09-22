'use client';

import { type InputHTMLAttributes, forwardRef, useId } from 'react';
import { FieldShell, fieldStateClasses } from './fieldChrome';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

// Covers text/number/date/etc. via the native `type` attribute (InputHTMLAttributes already includes it —
// no separate component per type). Select and Textarea are their own files since they're different
// elements, sharing this file's label/helper/error chrome via fieldChrome.tsx.
const Input = forwardRef<HTMLInputElement, InputProps>(({ label, helperText, error, id, className = '', ...props }, ref) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error ?? helperText;

  return (
    <FieldShell label={label} htmlFor={inputId} message={message} error={Boolean(error)}>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={message ? `${inputId}-message` : undefined}
        className={`rounded-lg border bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] ${fieldStateClasses({ error: Boolean(error), readOnly: props.readOnly })} ${className}`}
        {...props}
      />
    </FieldShell>
  );
});
Input.displayName = 'Input';

export default Input;
