import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { AppError } from "../../domain/errors.js";

const WHATSAPP_AUDIO_MIME_TYPES = new Set([
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/amr",
  "audio/ogg",
  "audio/opus",
]);

function resolveFfmpegBinary(): string {
  if (ffmpegStatic) return ffmpegStatic;
  return "ffmpeg";
}

function normalizeMimeType(mimeType: string): string {
  return mimeType.toLowerCase().split(";")[0]?.trim() || "application/octet-stream";
}

function toOggFileName(fileName: string): string {
  if (/\.ogg$/i.test(fileName)) return fileName;
  if (/\.[a-z0-9]+$/i.test(fileName)) {
    return fileName.replace(/\.[a-z0-9]+$/i, ".ogg");
  }
  return "voice.ogg";
}

async function convertWebmToOgg(input: Buffer): Promise<Buffer> {
  const ffmpegBinary = resolveFfmpegBinary();
  const id = randomUUID();
  const inputPath = join(tmpdir(), `chatpool-${id}.webm`);
  const outputPath = join(tmpdir(), `chatpool-${id}.ogg`);

  await writeFile(inputPath, input);

  try {
    await new Promise<void>((resolve, reject) => {
      const process = spawn(ffmpegBinary, [
        "-y",
        "-i",
        inputPath,
        "-vn",
        "-c:a",
        "libopus",
        outputPath,
      ]);

      let stderr = "";
      process.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      process.on("error", () => {
        reject(
          new AppError(
            "No se pudo convertir el audio para WhatsApp. Instala ffmpeg en el servidor.",
            503,
            "AUDIO_TRANSCODE_UNAVAILABLE"
          )
        );
      });

      process.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(
          new AppError(
            "No se pudo convertir el audio para WhatsApp",
            502,
            "AUDIO_TRANSCODE_FAILED"
          )
        );
      });
    });

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function normalizeAudioForWhatsApp(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const normalizedMime = normalizeMimeType(mimeType);

  if (WHATSAPP_AUDIO_MIME_TYPES.has(normalizedMime)) {
    return {
      buffer,
      mimeType: normalizedMime,
      fileName,
    };
  }

  if (normalizedMime === "audio/webm" || normalizedMime === "video/webm") {
    const converted = await convertWebmToOgg(buffer);
    return {
      buffer: converted,
      mimeType: "audio/ogg",
      fileName: toOggFileName(fileName),
    };
  }

  throw new AppError(
    `Formato de audio no compatible con WhatsApp (${normalizedMime})`,
    422,
    "WHATSAPP_AUDIO_UNSUPPORTED"
  );
}
