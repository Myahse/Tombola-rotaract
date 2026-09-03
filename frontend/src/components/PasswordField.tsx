import { useState } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  label: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
};

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12s-3.6 6.5-9.5 6.5S2.5 12 2.5 12Z"
      />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {off ? <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M4 20 20 4" /> : null}
    </svg>
  );
}

export function PasswordField({
  label,
  name,
  value,
  onChange,
  required,
  minLength,
  autoComplete,
}: Props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const controlled = value !== undefined;

  return (
    <label>
      {label}
      <span className="password-field">
        <input
          name={name}
          value={controlled ? value : undefined}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((open) => !open)}
          aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
          aria-pressed={visible}
        >
          <EyeIcon off={visible} />
        </button>
      </span>
    </label>
  );
}
