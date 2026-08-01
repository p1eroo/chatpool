import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceRecorderMode = "idle" | "recording" | "preview";

export interface VoiceRecordingResult {
  blob: Blob;
  url: string;
  durationSeconds: number;
}

export const WAVEFORM_BAR_COUNT = 48;

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export { formatTime as formatVoiceTime };

export function useVoiceRecorder() {
  const [mode, setMode] = useState<VoiceRecorderMode>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: WAVEFORM_BAR_COUNT }, () => 0.15)
  );

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const recordingStartRef = useRef(0);

  const stopAnalyserLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const cleanupAudioContext = useCallback(() => {
    stopAnalyserLoop();
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
  }, [stopAnalyserLoop]);

  const cleanupPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    blobRef.current = null;
    setIsPlaying(false);
    setPlaybackTime(0);
    setPreviewDuration(0);
  }, []);

  const resetLevels = useCallback(() => {
    setLevels(Array.from({ length: WAVEFORM_BAR_COUNT }, () => 0.15));
  }, []);

  const cancel = useCallback(() => {
    stopTimer();
    stopAnalyserLoop();

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];

    cleanupStream();
    cleanupAudioContext();
    cleanupPreview();

    setMode("idle");
    setElapsedSeconds(0);
    resetLevels();
  }, [
    cleanupAudioContext,
    cleanupPreview,
    cleanupStream,
    resetLevels,
    stopAnalyserLoop,
    stopTimer,
  ]);

  const startAnalyserLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const nextLevels: number[] = [];
      const step = Math.max(1, Math.floor(data.length / WAVEFORM_BAR_COUNT));

      for (let i = 0; i < WAVEFORM_BAR_COUNT; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += data[i * step + j] ?? 0;
        }
        const avg = sum / step / 255;
        nextLevels.push(Math.max(0.12, Math.min(1, avg * 2.8)));
      }

      setLevels(nextLevels);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const setupPreviewAudio = useCallback((blob: Blob) => {
    cleanupPreview();

    blobRef.current = blob;
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      const durationSeconds = Number.isFinite(audio.duration)
        ? Math.max(1, Math.round(audio.duration))
        : Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000));
      setPreviewDuration(durationSeconds);
      setElapsedSeconds(durationSeconds);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setPlaybackTime(0);
    };

    audio.ontimeupdate = () => {
      setPlaybackTime(audio.currentTime);
    };
  }, [cleanupPreview]);

  const finalizeRecorder = useCallback(
    (enterPreview: boolean) =>
      new Promise<VoiceRecordingResult | null>((resolve) => {
        const recorder = recorderRef.current;
        if (!recorder) {
          resolve(null);
          return;
        }

        stopTimer();
        stopAnalyserLoop();

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          const durationSeconds = Math.max(
            1,
            Math.round((Date.now() - recordingStartRef.current) / 1000)
          );

          cleanupStream();
          cleanupAudioContext();
          recorderRef.current = null;
          chunksRef.current = [];

          if (blob.size === 0) {
            resolve(null);
            return;
          }

          const url = URL.createObjectURL(blob);

          if (enterPreview) {
            setupPreviewAudio(blob);
            setMode("preview");
            resolve(null);
            return;
          }

          resolve({ blob, url, durationSeconds });
        };

        if (recorder.state !== "inactive") {
          recorder.stop();
        } else {
          resolve(null);
        }
      }),
    [cleanupAudioContext, cleanupStream, setupPreviewAudio, stopAnalyserLoop, stopTimer]
  );

  const start = useCallback(async () => {
    cancel();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.start(120);
      recordingStartRef.current = Date.now();
      setMode("recording");
      setElapsedSeconds(0);
      resetLevels();

      timerRef.current = window.setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - recordingStartRef.current) / 1000));
      }, 250);

      startAnalyserLoop();
      return true;
    } catch {
      cancel();
      return false;
    }
  }, [cancel, resetLevels, startAnalyserLoop]);

  const pauseRecording = useCallback(async () => {
    if (mode !== "recording") return;
    await finalizeRecorder(true);
  }, [finalizeRecorder, mode]);

  const sendRecording = useCallback(async (): Promise<VoiceRecordingResult | null> => {
    if (mode === "preview" && blobRef.current && previewUrlRef.current) {
      const result = {
        blob: blobRef.current,
        url: previewUrlRef.current,
        durationSeconds: previewDuration || elapsedSeconds || 1,
      };
      previewUrlRef.current = null;
      blobRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setMode("idle");
      return result;
    }

    if (mode === "recording") {
      return finalizeRecorder(false);
    }

    return null;
  }, [elapsedSeconds, finalizeRecorder, mode, previewDuration]);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [isPlaying]);

  useEffect(() => () => cancel(), [cancel]);

  return {
    mode,
    isActive: mode !== "idle",
    elapsedSeconds,
    previewDuration,
    playbackTime,
    isPlaying,
    levels,
    start,
    pauseRecording,
    sendRecording,
    togglePlayback,
    cancel,
  };
}
