'use client';

import { type TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { FieldShell, fieldStateClasses } from './fieldChrome';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, helperText, error, id, className = '', rows = 3, ...props }, ref) => {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const message = error ?? helperText;

  return (
    <FieldShell label={label} htmlFor={textareaId} message={message} error={Boolean(error)}>
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={message ? `${textareaId}-message` : undefined}
        className={`rounded-lg border bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] ${fieldStateClasses({ error: Boolean(error), readOnly: props.readOnly })} ${className}`}
        {...props}
      />
    </FieldShell>
  );
});
Textarea.displayName = 'Textarea';

export default Textarea;
