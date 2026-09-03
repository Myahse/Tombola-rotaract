import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PHONE_COUNTRIES,
  countryByIso,
  countryOptionLabel,
  digitsOnly,
  parsePhone,
  serializePhone,
} from "../lib/phone";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoComplete?: string;
};

export function PhoneField({ label, value, onChange, required, autoComplete = "tel-national" }: Props) {
  const { t, i18n } = useTranslation();
  const selectId = useId();
  const parsed = parsePhone(value);
  const [iso, setIso] = useState(parsed.iso);
  const [national, setNational] = useState(parsed.national);

  useEffect(() => {
    if (!value) {
      setNational("");
      return;
    }
    const next = parsePhone(value);
    setIso(next.iso);
    setNational(next.national);
  }, [value]);

  const country = countryByIso(iso);

  function emit(nextIso: string, nextNational: string) {
    setIso(nextIso);
    setNational(digitsOnly(nextNational));
    onChange(serializePhone(nextIso, nextNational));
  }

  return (
    <label>
      {label}
      <span className="phone-field">
        <select
          id={selectId}
          aria-label={t("auth.countryCode")}
          value={iso}
          onChange={(e) => emit(e.target.value, national)}
        >
          {PHONE_COUNTRIES.map((item) => (
            <option key={item.iso} value={item.iso}>
              {countryOptionLabel(item, i18n.language)}
            </option>
          ))}
        </select>
        <input
          value={national}
          onChange={(e) => emit(iso, digitsOnly(e.target.value))}
          onBeforeInput={(e) => {
            if (e.data && e.inputType === "insertText" && /\D/.test(e.data)) e.preventDefault();
          }}
          type="tel"
          inputMode="numeric"
          autoComplete={autoComplete}
          required={required}
          minLength={country.min}
          maxLength={country.max + (country.keepLeadingZero ? 0 : 1)}
          pattern="[0-9]*"
          placeholder={t("auth.phonePlaceholder")}
        />
      </span>
      {value ? <em className="field-hint">{t("auth.phoneSerialized", { number: value })}</em> : null}
    </label>
  );
}
