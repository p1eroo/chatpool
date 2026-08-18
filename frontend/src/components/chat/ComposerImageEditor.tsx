import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crop,
  Download,
  Pencil,
  Redo2,
  RotateCcw,
  RotateCw,
  Sparkles,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  blobToEditedFile,
  cloneEditorState,
  exportEditedImage,
  type CropRect,
  type DrawStroke,
  type EditorVisualState,
  type ImageEditorFilter,
  type TextOverlay,
} from "@/lib/imageEditorUtils";
import type { ComposerPendingAttachment } from "@/components/chat/ComposerPendingAttachments";
import {
  ComposerImageCropOverlay,
  createFullCropRect,
} from "@/components/chat/ComposerImageCropOverlay";

type EditorMode = "view" | "draw" | "text" | "filter" | "crop";

interface ComposerImageEditorProps {
  attachments: ComposerPendingAttachment[];
  initialId: string;
  onClose: () => void;
  onSave: (id: string, file: File, url: string) => void;
  discardOnClose?: boolean;
  onDiscard?: (id: string) => void;
}

interface SessionSnapshot {
  file: File;
  url: string;
  state: EditorVisualState;
}

interface EditSession {
  snapshots: SessionSnapshot[];
  index: number;
}

const DEFAULT_STATE: EditorVisualState = {
  rotation: 0,
  filter: "none",
  strokes: [],
  texts: [],
};

const DRAW_COLORS = ["#ffffff", "#111111", "#ef4444", "#22c55e", "#3b82f6", "#facc15"];
const TEXT_COLORS = ["#ffffff", "#111111", "#ef4444", "#22c55e", "#3b82f6"];

function createInitialSession(attachment: ComposerPendingAttachment): EditSession {
  return {
    snapshots: [
      {
        file: attachment.file,
        url: attachment.url,
        state: cloneEditorState(DEFAULT_STATE),
      },
    ],
    index: 0,
  };
}

function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: DrawStroke[],
  inProgress?: DrawStroke | null
) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const allStrokes = inProgress ? [...strokes, inProgress] : strokes;
  for (const stroke of allStrokes) {
    if (stroke.points.length < 2) continue;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i += 1) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }
}

export function ComposerImageEditor({
  attachments,
  initialId,
  onClose,
  onSave,
  discardOnClose = false,
  onDiscard,
}: ComposerImageEditorProps) {
  const [activeId, setActiveId] = useState(initialId);
  const [mode, setMode] = useState<EditorMode>("view");
  const [sessions, setSessions] = useState<Record<string, EditSession>>(() => {
    const initial: Record<string, EditSession> = {};
    for (const attachment of attachments) {
      initial[attachment.id] = createInitialSession(attachment);
    }
    return initial;
  });
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [textColor, setTextColor] = useState(TEXT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [cropDraft, setCropDraft] = useState<CropRect | null>(null);
  const [displaySize, setDisplaySize] = useState({ width: 640, height: 480 });
  const [textInput, setTextInput] = useState("");
  const [textPlacement, setTextPlacement] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<DrawStroke | null>(null);
  const redrawRafRef = useRef<number | null>(null);

  const activeIndex = attachments.findIndex((item) => item.id === activeId);
  const current = activeIndex >= 0 ? attachments[activeIndex] : attachments[0];
  const session = current ? sessions[current.id] : null;
  const snapshot = session?.snapshots[session.index] ?? null;
  const state = snapshot?.state ?? DEFAULT_STATE;
  const canUndo = (session?.index ?? 0) > 0;
  const canRedo = session ? session.index < session.snapshots.length - 1 : false;

  const resetTextDraft = useCallback(() => {
    setTextInput("");
    setTextPlacement(null);
  }, []);

  const exitTextMode = useCallback(() => {
    setMode("view");
    resetTextDraft();
  }, [resetTextDraft]);

  const enterTextMode = useCallback(() => {
    setMode("text");
    resetTextDraft();
  }, [resetTextDraft]);

  const handleClose = useCallback(() => {
    if (discardOnClose && current) {
      onDiscard?.(current.id);
    }
    for (const entry of Object.values(sessions)) {
      for (const snap of entry.snapshots) {
        if (snap.url.startsWith("blob:") && snap.url !== current?.url) {
          URL.revokeObjectURL(snap.url);
        }
      }
    }
    onClose();
  }, [current, discardOnClose, onClose, onDiscard, sessions]);

  const commitSnapshot = useCallback((id: string, next: SessionSnapshot) => {
    setSessions((prev) => {
      const currentSession = prev[id];
      if (!currentSession) return prev;

      const trimmed = currentSession.snapshots.slice(0, currentSession.index + 1);
      const previous = trimmed[trimmed.length - 1];
      if (
        previous &&
        previous.file === next.file &&
        previous.url === next.url &&
        JSON.stringify(previous.state) === JSON.stringify(next.state)
      ) {
        return prev;
      }

      return {
        ...prev,
        [id]: {
          snapshots: [...trimmed, next],
          index: trimmed.length,
        },
      };
    });
  }, []);

  const mutateState = useCallback(
    (updater: (prev: EditorVisualState) => EditorVisualState) => {
      if (!current || !snapshot) return;
      const nextState = cloneEditorState(updater(snapshot.state));
      commitSnapshot(current.id, {
        file: snapshot.file,
        url: snapshot.url,
        state: nextState,
      });
    },
    [commitSnapshot, current, snapshot]
  );

  const replaceSnapshot = useCallback(
    (next: SessionSnapshot) => {
      if (!current || !snapshot) return;
      if (snapshot.url !== next.url && snapshot.url.startsWith("blob:")) {
        URL.revokeObjectURL(snapshot.url);
      }
      commitSnapshot(current.id, next);
    },
    [commitSnapshot, current, snapshot]
  );

  const undo = useCallback(() => {
    if (!current) return;
    setSessions((prev) => {
      const entry = prev[current.id];
      if (!entry || entry.index <= 0) return prev;
      return {
        ...prev,
        [current.id]: { ...entry, index: entry.index - 1 },
      };
    });
    setMode("view");
    setCropDraft(null);
    resetTextDraft();
  }, [current, resetTextDraft]);

  const redo = useCallback(() => {
    if (!current) return;
    setSessions((prev) => {
      const entry = prev[current.id];
      if (!entry || entry.index >= entry.snapshots.length - 1) return prev;
      return {
        ...prev,
        [current.id]: { ...entry, index: entry.index + 1 },
      };
    });
    setMode("view");
    setCropDraft(null);
    resetTextDraft();
  }, [current, resetTextDraft]);

  const measureDisplaySize = useCallback(() => {
    const wrap = imageWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setDisplaySize({
      width: Math.max(rect.width, 1),
      height: Math.max(rect.height, 1),
    });
  }, []);

  const redrawCanvas = useCallback(
    (inProgressStroke?: DrawStroke | null) => {
      const canvas = canvasRef.current;
      const wrap = imageWrapRef.current;
      if (!canvas || !wrap) return;

      const rect = wrap.getBoundingClientRect();
      const cssWidth = Math.max(rect.width, 1);
      const cssHeight = Math.max(rect.height, 1);
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      drawStrokes(ctx, state.strokes, inProgressStroke ?? currentStrokeRef.current);
    },
    [state.strokes]
  );

  const scheduleRedraw = useCallback(
    (inProgressStroke?: DrawStroke | null) => {
      if (redrawRafRef.current !== null) {
        cancelAnimationFrame(redrawRafRef.current);
      }
      redrawRafRef.current = requestAnimationFrame(() => {
        redrawRafRef.current = null;
        redrawCanvas(inProgressStroke);
      });
    },
    [redrawCanvas]
  );

  useLayoutEffect(() => {
    measureDisplaySize();
    redrawCanvas();
  }, [current?.url, state.strokes, state.rotation, mode, measureDisplaySize, redrawCanvas]);

  useEffect(() => {
    const wrap = imageWrapRef.current;
    if (!wrap) return;

    const observer = new ResizeObserver(() => {
      measureDisplaySize();
      scheduleRedraw();
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [measureDisplaySize, scheduleRedraw, current?.url]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && (e.key.toLowerCase() === "z" && e.shiftKey || e.key.toLowerCase() === "y")) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Escape") {
        if (mode === "crop") {
          e.preventDefault();
          setMode("view");
          setCropDraft(null);
          return;
        }
        if (mode === "text") {
          e.preventDefault();
          exitTextMode();
          return;
        }
        e.preventDefault();
        handleClose();
      }
      if (e.key === "ArrowLeft" && activeIndex > 0) {
        setActiveId(attachments[activeIndex - 1].id);
        setMode("view");
        setCropDraft(null);
      }
      if (e.key === "ArrowRight" && activeIndex < attachments.length - 1) {
        setActiveId(attachments[activeIndex + 1].id);
        setMode("view");
        setCropDraft(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, attachments, exitTextMode, handleClose, mode, redo, undo]);

  useEffect(() => {
    return () => {
      if (redrawRafRef.current !== null) {
        cancelAnimationFrame(redrawRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mode !== "crop") return;
    setCropDraft(createFullCropRect(displaySize));
  }, [mode, displaySize.width, displaySize.height]);

  useEffect(() => {
    if (mode !== "text") return;
    setTextPlacement((prev) =>
      prev ?? {
        x: displaySize.width * 0.25,
        y: displaySize.height * 0.35,
      }
    );
    textInputRef.current?.focus();
  }, [mode, displaySize.width, displaySize.height]);

  if (!current || !snapshot) return null;

  const activeSnapshot = snapshot;
  const activeState = state;

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== "draw") return;
    drawingRef.current = true;
    const point = getCanvasPoint(event);
    currentStrokeRef.current = {
      color: drawColor,
      width: 4,
      points: [point],
    };
    scheduleRedraw(currentStrokeRef.current);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || mode !== "draw" || !currentStrokeRef.current) return;
    const point = getCanvasPoint(event);
    currentStrokeRef.current.points.push(point);
    scheduleRedraw(currentStrokeRef.current);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    drawingRef.current = false;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (stroke.points.length > 1) {
      mutateState((prev) => ({
        ...prev,
        strokes: [...prev.strokes, stroke],
      }));
    } else {
      scheduleRedraw(null);
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleImageTextPlacement(event: React.PointerEvent<HTMLDivElement>) {
    const wrap = imageWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTextPlacement({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    textInputRef.current?.focus();
  }

  function commitText() {
    const trimmed = textInput.trim();
    if (!trimmed || !textPlacement) return;

    mutateState((prev) => ({
      ...prev,
      texts: [
        ...prev.texts,
        {
          id: crypto.randomUUID(),
          text: trimmed,
          x: textPlacement.x,
          y: textPlacement.y,
          color: textColor,
          fontSize: 28,
        },
      ],
    }));
    setTextInput("");
    setTextPlacement({
      x: displaySize.width * 0.25,
      y: displaySize.height * 0.35,
    });
    textInputRef.current?.focus();
  }

  function getLiveDisplaySize() {
    const rect = imageWrapRef.current?.getBoundingClientRect();
    return {
      width: Math.max(rect?.width ?? displaySize.width, 1),
      height: Math.max(rect?.height ?? displaySize.height, 1),
    };
  }

  function getTextsForExport(): TextOverlay[] {
    const texts = [...activeState.texts];
    const trimmed = textInput.trim();
    if (trimmed && textPlacement) {
      texts.push({
        id: "__pending__",
        text: trimmed,
        x: textPlacement.x,
        y: textPlacement.y,
        color: textColor,
        fontSize: 28,
      });
    }
    return texts;
  }

  async function buildExportBlob(includeCrop = false) {
    const size = getLiveDisplaySize();
    return exportEditedImage({
      file: activeSnapshot.file,
      rotation: activeState.rotation,
      filter: activeState.filter,
      strokes: activeState.strokes,
      texts: getTextsForExport(),
      displayWidth: size.width,
      displayHeight: size.height,
      crop: includeCrop ? cropDraft ?? undefined : undefined,
    });
  }

  async function handleApplyCrop() {
    if (!cropDraft) return;
    try {
      const blob = await buildExportBlob(true);
      const nextFile = blobToEditedFile(blob, activeSnapshot.file);
      const nextUrl = URL.createObjectURL(nextFile);
      replaceSnapshot({
        file: nextFile,
        url: nextUrl,
        state: cloneEditorState(DEFAULT_STATE),
      });
      setMode("view");
      setCropDraft(null);
    } catch {
      window.alert("No se pudo recortar la imagen");
    }
  }

  async function handleDownload() {
    try {
      const blob = await buildExportBlob(false);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = activeSnapshot.file.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("No se pudo descargar la imagen");
    }
  }

  async function handleCopy() {
    try {
      const blob = await buildExportBlob(false);
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } catch {
      window.alert("No se pudo copiar la imagen");
    }
  }

  async function handleApply() {
    if (saving) return;
    setSaving(true);
    try {
      const blob = await buildExportBlob(false);
      const nextFile = blobToEditedFile(blob, activeSnapshot.file);
      const nextUrl = URL.createObjectURL(nextFile);
      onSave(current.id, nextFile, nextUrl);
      onClose();
    } catch {
      window.alert("No se pudo guardar la edición");
    } finally {
      setSaving(false);
    }
  }

  const filterOptions: Array<{ id: ImageEditorFilter; label: string }> = [
    { id: "none", label: "Original" },
    { id: "grayscale", label: "B/N" },
    { id: "sepia", label: "Sepia" },
    { id: "contrast", label: "Vivo" },
  ];

  return createPortal(
    <div
      data-modal-overlay
      className="fixed inset-0 z-[220] flex flex-col bg-[#111b21] animate-fade-in"
    >
      <div className="flex h-14 shrink-0 items-center gap-1 overflow-x-auto border-b border-white/8 px-3 md:px-4">
        <ToolbarIcon title="Cerrar" onClick={handleClose}>
          <X className="h-5 w-5" />
        </ToolbarIcon>

        <div className="mx-1 hidden h-6 w-px bg-white/10 md:block" />

        <ToolbarIcon title="Deshacer (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 className="h-[18px] w-[18px]" />
        </ToolbarIcon>
        <ToolbarIcon title="Rehacer (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
          <Redo2 className="h-[18px] w-[18px]" />
        </ToolbarIcon>

        <div className="mx-1 hidden h-6 w-px bg-white/10 md:block" />

        <ToolbarIcon
          title="Recortar"
          active={mode === "crop"}
          onClick={() =>
            setMode((value) => {
              if (value === "crop") {
                setCropDraft(null);
                return "view";
              }
              return "crop";
            })
          }
        >
          <Crop className="h-[18px] w-[18px]" />
        </ToolbarIcon>
        <ToolbarIcon
          title="Rotar izquierda"
          onClick={() => mutateState((prev) => ({ ...prev, rotation: prev.rotation - 90 }))}
        >
          <RotateCcw className="h-[18px] w-[18px]" />
        </ToolbarIcon>
        <ToolbarIcon
          title="Rotar derecha"
          onClick={() => mutateState((prev) => ({ ...prev, rotation: prev.rotation + 90 }))}
        >
          <RotateCw className="h-[18px] w-[18px]" />
        </ToolbarIcon>
        <ToolbarIcon
          title="Filtros"
          active={mode === "filter"}
          onClick={() => setMode((value) => (value === "filter" ? "view" : "filter"))}
        >
          <Sparkles className="h-[18px] w-[18px]" />
        </ToolbarIcon>
        <ToolbarIcon
          title="Dibujar"
          active={mode === "draw"}
          onClick={() => setMode((value) => (value === "draw" ? "view" : "draw"))}
        >
          <Pencil className="h-[18px] w-[18px]" />
        </ToolbarIcon>
        <ToolbarIcon
          title="Texto"
          active={mode === "text"}
          onClick={() => {
            if (mode !== "text") {
              enterTextMode();
              return;
            }
            exitTextMode();
          }}
        >
          <Type className="h-[18px] w-[18px]" />
        </ToolbarIcon>

        <div className="flex-1" />

        <ToolbarIcon title="Copiar" onClick={() => void handleCopy()}>
          <Copy className="h-[18px] w-[18px]" />
        </ToolbarIcon>
        <ToolbarIcon title="Descargar" onClick={() => void handleDownload()}>
          <Download className="h-[18px] w-[18px]" />
        </ToolbarIcon>
        <ToolbarIcon title="Listo" onClick={() => void handleApply()} disabled={saving}>
          <Check className="h-5 w-5" />
        </ToolbarIcon>
      </div>

      {mode === "crop" && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-4 py-2">
          <p className="text-xs text-white/70">Arrastra los bordes para recortar</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("view");
                setCropDraft(null);
              }}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/15"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleApplyCrop()}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#111b21] hover:bg-white/90"
            >
              Aplicar recorte
            </button>
          </div>
        </div>
      )}

      {mode === "filter" && (
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-white/8 px-4 py-2">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => mutateState((prev) => ({ ...prev, filter: option.id }))}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                state.filter === option.id
                  ? "bg-white text-[#111b21]"
                  : "bg-white/10 text-white/85 hover:bg-white/15"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {mode === "draw" && (
        <div className="flex shrink-0 items-center gap-2 border-b border-white/8 px-4 py-2">
          {DRAW_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title="Color de trazo"
              onClick={() => setDrawColor(color)}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform",
                drawColor === color ? "scale-110 border-white" : "border-transparent"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}

      {mode === "text" && (
        <div className="flex shrink-0 flex-col gap-2 border-b border-white/8 px-4 py-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setTextColor(color)}
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition-transform",
                  textColor === color ? "scale-110 border-white" : "border-transparent"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <input
            ref={textInputRef}
            type="text"
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitText();
              }
            }}
            placeholder="Escribe tu texto..."
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/45 focus:border-white/35"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exitTextMode}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/15"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={commitText}
              disabled={!textInput.trim()}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#111b21] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Añadir
            </button>
          </div>

          <p className="hidden text-[11px] text-white/55 sm:block sm:w-full">
            Toca la imagen para colocar el texto
          </p>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-4">
        {activeIndex > 0 && (
          <button
            type="button"
            onClick={() => {
              setActiveId(attachments[activeIndex - 1].id);
              setMode("view");
              setCropDraft(null);
            }}
            className="absolute left-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white/90 hover:bg-black/65"
            title="Imagen anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {activeIndex < attachments.length - 1 && (
          <button
            type="button"
            onClick={() => {
              setActiveId(attachments[activeIndex + 1].id);
              setMode("view");
              setCropDraft(null);
            }}
            className="absolute right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white/90 hover:bg-black/65"
            title="Imagen siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div
          ref={imageWrapRef}
          className="relative inline-block max-h-[calc(100vh-12rem)] max-w-full transition-transform duration-200"
          style={{ transform: `rotate(${state.rotation}deg)` }}
        >
          <img
            src={activeSnapshot.url}
            alt={activeSnapshot.file.name}
            className="block max-h-[calc(100vh-12rem)] max-w-full object-contain"
            style={{
              filter:
                state.filter === "none"
                  ? undefined
                  : state.filter === "grayscale"
                    ? "grayscale(100%)"
                    : state.filter === "sepia"
                      ? "sepia(80%)"
                      : "contrast(125%) saturate(110%)",
            }}
            draggable={false}
            onLoad={measureDisplaySize}
          />

          {state.texts.map((item: TextOverlay) => (
            <span
              key={item.id}
              className="pointer-events-none absolute font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
              style={{
                left: item.x,
                top: item.y,
                color: item.color,
                fontSize: item.fontSize,
              }}
            >
              {item.text}
            </span>
          ))}

          {mode === "text" && textPlacement && textInput.trim() && (
            <span
              className="pointer-events-none absolute font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] opacity-80"
              style={{
                left: textPlacement.x,
                top: textPlacement.y,
                color: textColor,
                fontSize: 28,
              }}
            >
              {textInput}
            </span>
          )}

          {mode === "text" && (
            <div
              className="absolute inset-0 z-[5] cursor-text"
              onPointerDown={handleImageTextPlacement}
            />
          )}

          {mode === "text" && textPlacement && !textInput.trim() && (
            <span
              className="pointer-events-none absolute rounded border border-dashed border-white/50 px-1 text-[11px] text-white/60"
              style={{
                left: textPlacement.x,
                top: Math.max(0, textPlacement.y - 18),
              }}
            >
              Toca para mover
            </span>
          )}

          {mode === "crop" && cropDraft && (
            <ComposerImageCropOverlay
              bounds={displaySize}
              crop={cropDraft}
              onChange={setCropDraft}
            />
          )}

          <canvas
            ref={canvasRef}
            className={cn(
              "absolute inset-0 h-full w-full",
              mode === "draw" ? "cursor-crosshair" : "pointer-events-none"
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
      </div>

      {attachments.length > 1 && (
        <div className="flex shrink-0 justify-center gap-2 px-4 pb-4">
          {attachments.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveId(item.id);
                setMode("view");
                setCropDraft(null);
              }}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                index === activeIndex ? "bg-white" : "bg-white/35 hover:bg-white/55"
              )}
              aria-label={`Editar imagen ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

function ToolbarIcon({
  children,
  title,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/10 hover:text-white",
        active && "bg-white/12 text-white",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
      )}
    >
      {children}
    </button>
  );
}
