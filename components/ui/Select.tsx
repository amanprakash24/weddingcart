'use client';

import { type SelectHTMLAttributes, forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { FieldShell, fieldStateClasses } from './fieldChrome';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, helperText, error, id, options, placeholder, className = '', ...props }, ref) => {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const message = error ?? helperText;

  return (
    <FieldShell label={label} htmlFor={selectId} message={message} error={Boolean(error)}>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={Boolean(error)}
          aria-describedby={message ? `${selectId}-message` : undefined}
          className={`w-full appearance-none rounded-lg border bg-[var(--color-bg-surface)] px-3 py-2 pr-9 text-sm text-[var(--color-text-primary)] outline-none transition-colors ${fieldStateClasses({ error: Boolean(error) })} ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden />
      </div>
    </FieldShell>
  );
});
Select.displayName = 'Select';

export default Select;
