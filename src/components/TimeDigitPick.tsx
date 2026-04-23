import type { AmPm } from "../lib/timeDigits";
import { formatDigitTimeDisplay, timeDigitsIssues } from "../lib/timeDigits";

type Props = {
  label: string;
  digits: string;
  period: AmPm;
  onDigitsChange: (digits: string) => void;
  onPeriodChange: (period: AmPm) => void;
  disabled?: boolean;
  showIssues?: boolean;
};

export function TimeDigitPick({
  label,
  digits,
  period,
  onDigitsChange,
  onPeriodChange,
  disabled,
  showIssues = true,
}: Props) {
  const issues = showIssues ? timeDigitsIssues(digits) : {};
  const invalid = Boolean(issues.hour || issues.minute);

  return (
    <div className={`time-digit-pick ${invalid ? "time-digit-pick--invalid" : ""}`}>
      <span className="time-digit-pick__label">{label}</span>
      <div className="time-digit-pick__row">
        <div className="time-digit-pick__field">
          <input
            className="time-digit-pick__digits"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            maxLength={4}
            placeholder="0000"
            aria-invalid={invalid}
            aria-label={label}
            value={digits}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 4);
              onDigitsChange(v);
            }}
          />
          <p className="time-digit-pick__preview" aria-hidden>
            {formatDigitTimeDisplay(digits)}
          </p>
        </div>
        <select
          className="time-digit-pick__ampm"
          value={period}
          disabled={disabled}
          aria-label={`${label} AM or PM`}
          onChange={(e) => onPeriodChange(e.target.value as AmPm)}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}
