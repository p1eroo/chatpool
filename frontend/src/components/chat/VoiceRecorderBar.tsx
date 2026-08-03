import { useEffect, useRef } from "react";
import { Mic, Pause, Play, Send, Trash2 } from "lucide-react";
import {
  formatVoiceTime,
  useVoiceRecorder,
  WAVEFORM_BAR_COUNT,
  type VoiceRecordingResult,
} from "@/hooks/useVoiceRecorder";
import { cn } from "@/lib/utils";

interface VoiceRecorderBarProps {
  onSend: (result: VoiceRecordingResult) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

export function VoiceRecorderBar({ onSend, onCancel, onError }: VoiceRecorderBarProps) {
  const recorder = useVoiceRecorder();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let active = true;

    void recorder.start().then((started) => {
      if (!active) return;
      if (!started) {
        onError("No se pudo acceder al micrófono");
        onCancel();
      }
    });

    return () => {
      active = false;
      recorder.cancel();
    };
  }, []);

  const handleCancel = () => {
    recorder.cancel();
    onCancel();
  };

  const handleSend = async () => {
    const result = await recorder.sendRecording();
    if (!result) {
      onError("La grabación está vacía");
      return;
    }

    onSend(result);
    recorder.confirmSent();
  };

  const isPreview = recorder.mode === "preview";
  const displaySeconds = isPreview
    ? Math.max(0, Math.floor(recorder.previewDuration - recorder.playbackTime))
    : recorder.elapsedSeconds;

  const progress =
    isPreview && recorder.previewDuration > 0
      ? recorder.playbackTime / recorder.previewDuration
      : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-full bg-[#111b21] border border-[#2a3942] min-h-[52px]">
        <button
          type="button"
          onClick={handleCancel}
          className="w-8 h-8 flex items-center justify-center rounded-full text-[#aebac1] hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title="Descartar"
        >
          <Trash2 className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </button>

        {isPreview ? (
          <button
            type="button"
            onClick={recorder.togglePlayback}
            className="w-8 h-8 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors shrink-0"
            title={recorder.isPlaying ? "Pausar" : "Reproducir"}
          >
            {recorder.isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white ml-0.5" />
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#ff667f] animate-pulse" />
            <span className="text-sm text-[#e9edef] tabular-nums min-w-[2.5rem]">
              {formatVoiceTime(recorder.elapsedSeconds)}
            </span>
          </div>
        )}

        <div className="flex-1 flex items-center justify-center min-w-0 px-1">
          {isPreview ? (
            <PreviewWaveform progress={progress} />
          ) : (
            <LiveWaveform levels={recorder.levels} />
          )}
        </div>

        {isPreview ? (
          <>
            <span className="text-sm text-[#e9edef] tabular-nums shrink-0 min-w-[2.5rem] text-right">
              {formatVoiceTime(displaySeconds)}
            </span>
            <Mic className="w-[18px] h-[18px] text-[#ff667f] shrink-0" strokeWidth={1.75} />
          </>
        ) : (
          <button
            type="button"
            onClick={() => void recorder.pauseRecording()}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#ff667f] hover:bg-white/10 transition-colors shrink-0"
            title="Pausar grabación"
          >
            <Pause className="w-4 h-4" strokeWidth={2.5} />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => void handleSend()}
        className="w-11 h-11 flex items-center justify-center rounded-full bg-[#00a884] text-[#111b21] hover:bg-[#06cf9c] active:scale-95 transition-all shrink-0 shadow-md"
        title="Enviar audio"
      >
        <Send className="w-[18px] h-[18px]" strokeWidth={2.25} />
      </button>
    </div>
  );
}

function LiveWaveform({ levels }: { levels: number[] }) {
  return (
    <div className="flex items-center justify-center gap-[3px] w-full h-8 overflow-hidden">
      {levels.map((level, index) => (
        <span
          key={index}
          className="w-[3px] rounded-full bg-[#8696a0] transition-[height] duration-75"
          style={{ height: `${Math.max(4, level * 28)}px` }}
        />
      ))}
    </div>
  );
}

function PreviewWaveform({ progress }: { progress: number }) {
  const activeIndex = Math.min(
    WAVEFORM_BAR_COUNT - 1,
    Math.floor(progress * WAVEFORM_BAR_COUNT)
  );

  return (
    <div className="flex items-center justify-center gap-[5px] w-full h-8 overflow-hidden">
      {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "rounded-full transition-colors duration-150",
            index === activeIndex
              ? "w-2 h-2 bg-[#00a884]"
              : "w-1 h-1 bg-[#8696a0]"
          )}
        />
      ))}
    </div>
  );
}
