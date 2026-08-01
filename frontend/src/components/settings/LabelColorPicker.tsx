import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_LABEL_COLOR,
  LABEL_PRESET_COLORS,
  hexToHsl,
  hslToHex,
  isHexColor,
  normalizeHexColor,
} from "@/lib/labelColorUtils";
import { cn } from "@/lib/utils";

interface LabelColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

export function LabelColorPicker({ value, onChange }: LabelColorPickerProps) {
  const initial = hexToHsl(normalizeHexColor(value));
  const [hue, setHue] = useState(initial.h);
  const [saturation, setSaturation] = useState(initial.s);
  const [lightness, setLightness] = useState(initial.l);
  const [hexInput, setHexInput] = useState(normalizeHexColor(value));
  const svRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const normalized = normalizeHexColor(value);
    const hsl = hexToHsl(normalized);
    setHue(hsl.h);
    setSaturation(hsl.s);
    setLightness(hsl.l);
    setHexInput(normalized);
  }, [value]);

  const currentHex = hslToHex(hue, saturation, lightness);

  const applyHsl = (nextHue: number, nextSaturation: number, nextLightness: number) => {
    const clampedS = Math.max(0, Math.min(100, nextSaturation));
    const clampedL = Math.max(0, Math.min(100, nextLightness));
    const nextHex = hslToHex(nextHue, clampedS, clampedL);
    setHue(nextHue);
    setSaturation(clampedS);
    setLightness(clampedL);
    setHexInput(nextHex);
    onChange(nextHex);
  };

  const updateFromSvPoint = (clientX: number, clientY: number) => {
    const element = svRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    applyHsl(hue, (x / rect.width) * 100, 100 - (y / rect.height) * 100);
  };

  const startSvDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateFromSvPoint(event.clientX, event.clientY);

    const handleMove = (moveEvent: PointerEvent) => {
      updateFromSvPoint(moveEvent.clientX, moveEvent.clientY);
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const handleHexInput = (raw: string) => {
    const next = raw.startsWith("#") ? raw : `#${raw}`;
    setHexInput(next.toUpperCase());

    if (isHexColor(next)) {
      const hsl = hexToHsl(normalizeHexColor(next));
      setHue(hsl.h);
      setSaturation(hsl.s);
      setLightness(hsl.l);
      onChange(normalizeHexColor(next));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="h-8 w-8 rounded-md border border-[var(--color-border-primary)] shrink-0"
          style={{ backgroundColor: currentHex }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(event) => handleHexInput(event.target.value)}
          className="h-9 flex-1 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] px-3 text-sm font-mono uppercase text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)]"
          spellCheck={false}
        />
      </div>

      <div
        ref={svRef}
        className="relative h-40 w-full cursor-crosshair overflow-hidden rounded-lg border border-[var(--color-border-primary)] touch-none"
        style={{
          background: `
            linear-gradient(to top, #000, transparent),
            linear-gradient(to right, #fff, hsl(${hue} 100% 50%))
          `,
        }}
        onPointerDown={startSvDrag}
      >
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
          style={{
            left: `${saturation}%`,
            top: `${100 - lightness}%`,
            backgroundColor: currentHex,
          }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={360}
        value={hue}
        onChange={(event) => applyHsl(Number(event.target.value), saturation, lightness)}
        className="h-3 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background:
            "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
        }}
      />

      <div className="flex flex-wrap gap-2">
        {LABEL_PRESET_COLORS.map((preset) => {
          const selected = normalizeHexColor(currentHex) === preset;
          return (
            <button
              key={preset}
              type="button"
              title={preset}
              onClick={() => onChange(preset)}
              className={cn(
                "h-7 w-7 rounded-md border transition-transform hover:scale-105",
                selected
                  ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/30"
                  : "border-[var(--color-border-primary)]"
              )}
              style={{ backgroundColor: preset }}
            />
          );
        })}
      </div>
    </div>
  );
}

export { DEFAULT_LABEL_COLOR };
