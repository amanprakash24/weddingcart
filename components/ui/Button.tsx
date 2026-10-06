'use client';

import { type ButtonHTMLAttributes, forwardRef } from 'react';

export type ButtonStyle = 'primary' | 'secondary' | 'outline' | 'danger';
export type ButtonSize = 'medium' | 'small';

const STYLE_CLASSES: Record<ButtonStyle, string> = {
  primary: 'bg-[var(--primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]',
  secondary:
    'bg-[var(--color-bg-surface-muted)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:bg-[var(--color-border-subtle)]',
  outline:
    'bg-transparent text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-muted)]',
  danger: 'bg-[var(--color-danger-default)] text-[var(--color-on-primary)] hover:bg-[var(--color-danger-text)]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  medium: 'px-4 py-2 text-sm',
  small: 'px-3 py-1 text-xs',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonStyle;
  size?: ButtonSize;
}

// Matches the Button component set in the Vivah OS Figma file (Style x Size x Disabled) — keep both in sync.
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'medium', className = '', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${STYLE_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export default Button;
