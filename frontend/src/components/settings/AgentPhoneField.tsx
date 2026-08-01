import { ChevronDown } from "lucide-react";
import {
  formatPhoneInputDisplay,
  getAgentPhoneValidationError,
  isValidAgentPhoneInput,
  sanitizeAgentPhoneInput,
} from "@/lib/agentPhone";
import { APP_PHONE_PREFIX } from "@/lib/locale";
import { cn } from "@/lib/utils";

interface AgentPhoneFieldProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function AgentPhoneField({ value, onChange, required = true }: AgentPhoneFieldProps) {
  const digits = sanitizeAgentPhoneInput(value);
  const display = formatPhoneInputDisplay(digits);
  const validationError = getAgentPhoneValidationError(digits, { optional: !required });
  const showError = digits.length > 0 && validationError !== null;
  const isValid = isValidAgentPhoneInput(digits, { optional: !required });

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex items-center gap-1.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg px-2 shrink-0 h-[42px]">
          <span className="text-sm">🇵🇪</span>
          <span className="text-xs text-[var(--color-text-secondary)]">{APP_PHONE_PREFIX}</span>
          <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)]" />
        </div>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={11}
          value={display}
          onChange={(e) => onChange(sanitizeAgentPhoneInput(e.target.value))}
          placeholder="987 654 321"
          className={cn(
            inputClass,
            "flex-1 tabular-nums",
            showError && "border-[var(--color-danger)] focus:border-[var(--color-danger)]",
            isValid && "border-[var(--color-brand)] focus:border-[var(--color-brand)]"
          )}
        />
      </div>
      {showError ? (
        <p className="text-[11px] text-[var(--color-danger)] mt-1">{validationError}</p>
      ) : (
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
          {required
            ? "Celular peruano de 9 dígitos, comenzando en 9."
            : "Opcional. Celular peruano de 9 dígitos, comenzando en 9."}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "w-full bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-primary)] rounded-lg px-3 py-2.5 outline-none border border-[var(--color-border-primary)] focus:border-[var(--color-brand)] transition-colors placeholder:text-[var(--color-text-muted)]";
