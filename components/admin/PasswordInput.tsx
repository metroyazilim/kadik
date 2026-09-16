"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { fieldInput } from "./ui";

export type PasswordInputProps = Readonly<{
  name: string;
  id?: string;
  label?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  minLength?: number;
  defaultValue?: string;
  className?: string;
}>;

/**
 * The single password field used by every admin surface (login, password
 * reset, Developer Mode re-authentication). Reveal state is local to the
 * field - the value is never mirrored into a second element, so a revealed
 * password cannot leak into a stray hidden input or React state snapshot.
 * The toggle is a real `<button type="button">` so it never submits the
 * owning form and stays reachable by keyboard.
 */
export function PasswordInput({
  name,
  id,
  autoComplete = "current-password",
  required = false,
  disabled = false,
  placeholder,
  minLength,
  defaultValue,
  className,
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? `${name}-${generatedId}`;
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      <input
        id={inputId}
        name={name}
        type={revealed ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        minLength={minLength}
        defaultValue={defaultValue}
        className={`${className ?? fieldInput} pe-11`}
      />
      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        disabled={disabled}
        aria-controls={inputId}
        aria-pressed={revealed}
        aria-label={revealed ? "Şifreyi gizle" : "Şifreyi göster"}
        title={revealed ? "Şifreyi gizle" : "Şifreyi göster"}
        className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-brand-muted transition-colors hover:text-brand-text disabled:opacity-40"
      >
        {revealed ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
