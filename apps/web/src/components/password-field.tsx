"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type KeyboardEventHandler } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  /** Plain text field (e.g. recovery key) — no eye toggle. */
  revealAlways?: boolean;
  disabled?: boolean;
};

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  onKeyDown,
  revealAlways = false,
  disabled = false,
}: Props) {
  const [visible, setVisible] = useState(false);
  const show = revealAlways || visible;

  return (
    <label className="zp-gate-field">
      <span>{label}</span>
      <div className={revealAlways ? "zp-password zp-password--plain" : "zp-password"}>
        <input
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          disabled={disabled}
        />
        {!revealAlways ? (
          <button
            type="button"
            className="zp-password-toggle"
            title={visible ? "Hide password" : "Show password"}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        ) : null}
      </div>
    </label>
  );
}
