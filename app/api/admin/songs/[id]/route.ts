import { isAdminRequest } from "@/lib/admin-auth";
import { findAdminSong, getBucket, removeSong, updateSong } from "@/lib/database";
import { parseSongForm, safeFilename } from "@/lib/song-input";

type Context = { params: Promise<{ id: string }> };

function unauthorized() {
  return Response.json({ error: "Требуется вход в админку." }, { status: 401 });
}

async function newUpload(form: FormData, field: string, folder: "covers" | "pdfs") {
  const value = form.get(field);
  if (!(value instanceof File) || value.size === 0) return null;
  const bucket = getBucket();
  if (!bucket) throw new Error("Хранилище файлов недоступно.");
  if (folder === "covers" && (!value.type.startsWith("image/") || value.size > 8 * 1024 * 1024)) {
    throw new Error("Нужна обложка-изображение размером до 8 МБ.");
  }
  if (folder === "pdfs" && (value.type !== "application/pdf" || value.size > 50 * 1024 * 1024)) {
    throw new Error("Нужен PDF-файл размером до 50 МБ.");
  }
  const key = `${folder}/${crypto.randomUUID()}-${safeFilename(value.name)}`;
  await bucket.put(key, await value.arrayBuffer(), {
    httpMetadata: { contentType: value.type || "application/octet-stream" },
    customMetadata: { originalName: value.name },
  });
  return key;
}

export async function PUT(request: Request, context: Context) {
  if (!(await isAdminRequest(request))) return unauthorized();
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "Некорректный ID." }, { status: 400 });

  try {
    const existing = await findAdminSong(id);
    if (!existing) return Response.json({ error: "Разбор не найден." }, { status: 404 });
    const form = await request.formData();
    const input = parseSongForm(form, existing);
    const bucket = getBucket();
    const coverKey = await newUpload(form, "cover", "covers");
    const pdfKey = await newUpload(form, "pdf", "pdfs");
    if (coverKey) {
      if (existing.coverKey) await bucket?.delete(existing.coverKey);
      input.coverKey = coverKey;
    }
    if (pdfKey) {
      if (existing.pdfKey) await bucket?.delete(existing.pdfKey);
      input.pdfKey = pdfKey;
    }
    const song = await updateSong(id, input);
    return Response.json({ song });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить разбор.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!(await isAdminRequest(request))) return unauthorized();
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "Некорректный ID." }, { status: 400 });
  const removed = await removeSong(id);
  if (!removed) return Response.json({ error: "Разбор не найден." }, { status: 404 });
  const bucket = getBucket();
  await Promise.all([
    removed.coverKey ? bucket?.delete(removed.coverKey) : Promise.resolve(),
    removed.pdfKey ? bucket?.delete(removed.pdfKey) : Promise.resolve(),
  ]);
  return Response.json({ ok: true });
}
