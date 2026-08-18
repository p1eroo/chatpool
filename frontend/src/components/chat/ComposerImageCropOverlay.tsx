import { useCallback, useRef } from "react";
import type { CropRect } from "@/lib/imageEditorUtils";

const MIN_SIZE = 48;

interface ComposerImageCropOverlayProps {
  bounds: { width: number; height: number };
  crop: CropRect;
  onChange: (crop: CropRect) => void;
}

type DragKind =
  | "move"
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

function clampCrop(next: CropRect, bounds: { width: number; height: number }): CropRect {
  const width = Math.max(MIN_SIZE, Math.min(next.width, bounds.width));
  const height = Math.max(MIN_SIZE, Math.min(next.height, bounds.height));
  const x = Math.max(0, Math.min(next.x, bounds.width - width));
  const y = Math.max(0, Math.min(next.y, bounds.height - height));
  return { x, y, width, height };
}

export function ComposerImageCropOverlay({
  bounds,
  crop,
  onChange,
}: ComposerImageCropOverlayProps) {
  const dragRef = useRef<{
    kind: DragKind;
    startX: number;
    startY: number;
    startCrop: CropRect;
  } | null>(null);

  const startDrag = useCallback(
    (kind: DragKind, event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = {
        kind,
        startX: event.clientX,
        startY: event.clientY,
        startCrop: crop,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [crop]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const base = drag.startCrop;
      let next = { ...base };

      switch (drag.kind) {
        case "move":
          next = { ...base, x: base.x + dx, y: base.y + dy };
          break;
        case "n":
          next = {
            x: base.x,
            y: base.y + dy,
            width: base.width,
            height: base.height - dy,
          };
          break;
        case "s":
          next = { ...base, height: base.height + dy };
          break;
        case "w":
          next = {
            x: base.x + dx,
            y: base.y,
            width: base.width - dx,
            height: base.height,
          };
          break;
        case "e":
          next = { ...base, width: base.width + dx };
          break;
        case "ne":
          next = {
            x: base.x,
            y: base.y + dy,
            width: base.width + dx,
            height: base.height - dy,
          };
          break;
        case "nw":
          next = {
            x: base.x + dx,
            y: base.y + dy,
            width: base.width - dx,
            height: base.height - dy,
          };
          break;
        case "se":
          next = {
            x: base.x,
            y: base.y,
            width: base.width + dx,
            height: base.height + dy,
          };
          break;
        case "sw":
          next = {
            x: base.x + dx,
            y: base.y,
            width: base.width - dx,
            height: base.height + dy,
          };
          break;
      }

      onChange(clampCrop(next, bounds));
    },
    [bounds, onChange]
  );

  const endDrag = useCallback((event: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const handles: Array<{ kind: DragKind; className: string }> = [
    { kind: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
    { kind: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize" },
    { kind: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
    { kind: "e", className: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
    { kind: "se", className: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
    { kind: "s", className: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize" },
    { kind: "sw", className: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize" },
    { kind: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
  ];

  return (
    <div
      className="absolute inset-0 z-10 touch-none"
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="absolute border-2 border-white/90"
        style={{
          left: crop.x,
          top: crop.y,
          width: crop.width,
          height: crop.height,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
        }}
        onPointerDown={(event) => startDrag("move", event)}
      >
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="border border-white/25" />
          ))}
        </div>

        {handles.map((handle) => (
          <div
            key={handle.kind}
            className={`absolute h-4 w-4 rounded-full border-2 border-white bg-[#111b21] ${handle.className}`}
            onPointerDown={(event) => startDrag(handle.kind, event)}
          />
        ))}
      </div>
    </div>
  );
}

export function createFullCropRect(bounds: { width: number; height: number }): CropRect {
  return {
    x: 0,
    y: 0,
    width: Math.max(bounds.width, MIN_SIZE),
    height: Math.max(bounds.height, MIN_SIZE),
  };
}
