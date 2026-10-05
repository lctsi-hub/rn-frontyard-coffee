import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const control =
  "mt-2 w-full rounded-2xl bg-foam px-4 text-base text-espresso ring-1 ring-espresso/10 transition-shadow placeholder:text-mocha/60 focus:ring-2 focus:ring-espresso focus:outline-none aria-invalid:ring-2 aria-invalid:ring-berry";

type FieldShellProps = {
  id: string;
  label: string;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
};

function FieldShell({ id, label, optional, hint, error, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{label}</span>
        {optional && <span className="text-xs text-mocha">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-message`} role="alert" className="mt-1.5 text-sm font-medium text-berry">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-message`} className="mt-1.5 text-xs text-mocha">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

type Common = { id: string; label: string; optional?: boolean; hint?: ReactNode; error?: string };

export function TextField({ id, label, optional, hint, error, className, ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell id={id} label={label} optional={optional} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        className={cn(control, "h-13", className)}
        {...props}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  id,
  label,
  optional,
  hint,
  error,
  className,
  ...props
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell id={id} label={label} optional={optional} hint={hint} error={error}>
      <textarea
        id={id}
        rows={2}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        className={cn(control, "resize-none py-3", className)}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  id,
  label,
  optional,
  hint,
  error,
  className,
  children,
  ...props
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell id={id} label={label} optional={optional} hint={hint} error={error}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-message` : undefined}
          className={cn(control, "h-13 appearance-none pr-10", className)}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute top-1/2 right-4 mt-1 size-4 -translate-y-1/2 text-mocha"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </div>
    </FieldShell>
  );
}
