// İstemci tarafı görsel sıkıştırma: büyük görselleri yüklemeden önce ölçekle + yeniden
// kodla, böylece Storage küçük kalır. Hatada veya küçük dosyada orijinali döndür —
// sıkıştırma kullanıcıyı asla bloklamasın.
export async function compressImage(
  file: File,
  opts: { maxEdge?: number; quality?: number; mime?: "image/jpeg" | "image/webp" } = {}
): Promise<File> {
  const { maxEdge = 1600, quality = 0.85, mime = "image/jpeg" } = opts;

  // GIF (animasyon) ve SVG (vektör) canvas'ta bozulur → olduğu gibi bırak
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/gif" ||
    file.type === "image/svg+xml"
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, mime, quality)
    );
    if (!blob) return file;
    // Ölçeklenmediyse ve yeniden kodlama küçültmediyse orijinali kullan
    if (scale === 1 && blob.size >= file.size) return file;

    const ext = mime === "image/webp" ? "webp" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.${ext}`, { type: mime });
  } catch {
    return file;
  }
}
