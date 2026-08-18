export type ImageEditorFilter = "none" | "grayscale" | "sepia" | "contrast";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawStroke {
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
}

export interface EditorVisualState {
  rotation: number;
  filter: ImageEditorFilter;
  strokes: DrawStroke[];
  texts: TextOverlay[];
}

export function cloneEditorState(state: EditorVisualState): EditorVisualState {
  return {
    rotation: state.rotation,
    filter: state.filter,
    strokes: state.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
    })),
    texts: state.texts.map((text) => ({ ...text })),
  };
}

const FILTER_CSS: Record<ImageEditorFilter, string> = {
  none: "none",
  grayscale: "grayscale(100%)",
  sepia: "sepia(80%)",
  contrast: "contrast(125%) saturate(110%)",
};

export function getFilterCss(filter: ImageEditorFilter): string {
  return FILTER_CSS[filter];
}

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo cargar la imagen"));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function mapPointToImageSpace(
  point: { x: number; y: number },
  displayWidth: number,
  displayHeight: number,
  imageWidth: number,
  imageHeight: number
) {
  return {
    x: (point.x / displayWidth) * imageWidth,
    y: (point.y / displayHeight) * imageHeight,
  };
}

function mapDisplayRectToCanvas(
  rect: CropRect,
  displayWidth: number,
  displayHeight: number,
  canvasWidth: number,
  canvasHeight: number
): CropRect {
  const scaleX = canvasWidth / displayWidth;
  const scaleY = canvasHeight / displayHeight;
  return {
    x: Math.max(0, Math.round(rect.x * scaleX)),
    y: Math.max(0, Math.round(rect.y * scaleY)),
    width: Math.max(1, Math.round(rect.width * scaleX)),
    height: Math.max(1, Math.round(rect.height * scaleY)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("No se pudo exportar la imagen"));
      },
      mimeType,
      0.92
    );
  });
}

export async function exportEditedImage(params: {
  file: File;
  rotation: number;
  filter: ImageEditorFilter;
  strokes: DrawStroke[];
  texts: TextOverlay[];
  displayWidth: number;
  displayHeight: number;
  crop?: CropRect;
}): Promise<Blob> {
  const image = await loadImageFromFile(params.file);
  const rotation = ((params.rotation % 360) + 360) % 360;
  const swap = rotation === 90 || rotation === 270;
  const canvasWidth = swap ? image.height : image.width;
  const canvasHeight = swap ? image.width : image.height;

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo editar la imagen");

  ctx.filter = getFilterCss(params.filter);
  ctx.translate(canvasWidth / 2, canvasHeight / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";

  const scaleX = canvasWidth / params.displayWidth;
  const scaleY = canvasHeight / params.displayHeight;

  for (const stroke of params.strokes) {
    if (stroke.points.length < 2) continue;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * Math.max(scaleX, scaleY);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const first = mapPointToImageSpace(
      stroke.points[0],
      params.displayWidth,
      params.displayHeight,
      canvasWidth,
      canvasHeight
    );
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < stroke.points.length; i += 1) {
      const point = mapPointToImageSpace(
        stroke.points[i],
        params.displayWidth,
        params.displayHeight,
        canvasWidth,
        canvasHeight
      );
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }

  for (const item of params.texts) {
    const mapped = mapPointToImageSpace(
      { x: item.x, y: item.y },
      params.displayWidth,
      params.displayHeight,
      canvasWidth,
      canvasHeight
    );
    ctx.fillStyle = item.color;
    ctx.font = `600 ${item.fontSize * Math.max(scaleX, scaleY)}px Inter, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(item.text, mapped.x, mapped.y);
  }

  const mimeType = params.file.type.startsWith("image/") ? params.file.type : "image/png";

  if (params.crop) {
    const mapped = mapDisplayRectToCanvas(
      params.crop,
      params.displayWidth,
      params.displayHeight,
      canvasWidth,
      canvasHeight
    );
    const maxWidth = canvasWidth - mapped.x;
    const maxHeight = canvasHeight - mapped.y;
    mapped.width = Math.min(mapped.width, maxWidth);
    mapped.height = Math.min(mapped.height, maxHeight);

    const cropped = document.createElement("canvas");
    cropped.width = mapped.width;
    cropped.height = mapped.height;
    const croppedCtx = cropped.getContext("2d");
    if (!croppedCtx) throw new Error("No se pudo recortar la imagen");
    croppedCtx.drawImage(
      canvas,
      mapped.x,
      mapped.y,
      mapped.width,
      mapped.height,
      0,
      0,
      mapped.width,
      mapped.height
    );
    return canvasToBlob(cropped, mimeType);
  }

  return canvasToBlob(canvas, mimeType);
}

export function blobToEditedFile(blob: Blob, original: File): File {
  const extension =
    blob.type === "image/jpeg"
      ? "jpg"
      : blob.type === "image/webp"
        ? "webp"
        : blob.type === "image/gif"
          ? "gif"
          : "png";

  const baseName = original.name.replace(/\.[^.]+$/, "") || "imagen";
  return new File([blob], `${baseName}.${extension}`, {
    type: blob.type,
    lastModified: Date.now(),
  });
}
