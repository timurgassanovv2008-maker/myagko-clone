"use client";

// Подготовка фото в браузере: поворот по EXIF, уменьшение до 2000 px, JPEG.
// Так фото с телефона (5–10 МБ) влезает в лимит запроса хостинга. Сервер всё равно проверит формат и пережмёт.

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIDE = 2000;

async function decode(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), type, quality),
  );
}

function draw(bitmap: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // прозрачный PNG — на белом фоне
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export class ImagePrepError extends Error {}

/** Сжатый файл для загрузки и маленькое превью для черновика. */
export async function prepareImage(file: File): Promise<{ blob: Blob; thumb: string }> {
  if (!ACCEPTED_TYPES.includes(file.type) && file.type !== "") {
    throw new ImagePrepError("Подходят только JPEG, PNG или WebP");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch {
    throw new ImagePrepError("Не удалось открыть изображение");
  }
  try {
    const blob = await toBlob(draw(bitmap, MAX_SIDE), "image/jpeg", 0.85);
    const thumbCanvas = draw(bitmap, 240);
    const thumb = thumbCanvas.toDataURL("image/jpeg", 0.7);
    return { blob, thumb };
  } finally {
    bitmap.close();
  }
}
