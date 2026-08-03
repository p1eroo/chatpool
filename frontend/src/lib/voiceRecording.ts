const RECORDER_MIME_TYPES = [
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/webm;codecs=opus",
  "audio/webm",
] as const;

export function resolveRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") {
    return "audio/webm";
  }

  for (const mimeType of RECORDER_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return "audio/webm";
}

export function voiceFileFromBlob(blob: Blob): File {
  const mimeType = blob.type || resolveRecorderMimeType();
  const extension = mimeType.includes("ogg") ? "ogg" : "webm";
  return new File([blob], `voice.${extension}`, { type: mimeType });
}
