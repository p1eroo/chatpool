import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface SecretInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Valor guardado en servidor; se muestra al pulsar el ojo si el campo está vacío. */
  storedValue?: string;
  /** Si true, el valor se muestra en texto plano al montar (p. ej. credenciales guardadas). */
  defaultVisible?: boolean;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
  revealLabel?: string;
  hideLabel?: string;
}

export function SecretInput({
  value,
  onChange,
  storedValue,
  defaultVisible = false,
  placeholder,
  className,
  autoComplete = "off",
  revealLabel = "Mostrar",
  hideLabel = "Ocultar",
}: SecretInputProps) {
  const [visible, setVisible] = useState(defaultVisible);
  const canReveal = Boolean(value || storedValue);
  const displayValue = value || (visible ? storedValue ?? "" : "");

  useEffect(() => {
    if (defaultVisible) {
      setVisible(true);
    }
  }, [defaultVisible]);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn(className, "pr-10")}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        disabled={!canReveal}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
        title={visible ? hideLabel : revealLabel}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
