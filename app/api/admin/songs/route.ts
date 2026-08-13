import { isAdminRequest } from "@/lib/admin-auth";
import { createSong, getBucket, listAdminSongs } from "@/lib/database";
import { parseSongForm, safeFilename } from "@/lib/song-input";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Требуется вход в админку." }, { status: 401 });
}

async function uploadFile(form: FormData, field: string, folder: "covers" | "pdfs") {
  const value = form.get(field);
  if (!(value instanceof File) || value.size === 0) return null;
  const bucket = getBucket();
  if (!bucket) throw new Error("Хранилище файлов недоступно.");

  if (folder === "covers") {
    if (!value.type.startsWith("image/")) throw new Error("Обложка должна быть изображением.");
    if (value.size > 8 * 1024 * 1024) throw new Error("Обложка должна быть меньше 8 МБ.");
  } else {
    if (value.type !== "application/pdf") throw new Error("Материал должен быть PDF-файлом.");
    if (value.size > 50 * 1024 * 1024) throw new Error("PDF должен быть меньше 50 МБ.");
  }

  const key = `${folder}/${crypto.randomUUID()}-${safeFilename(value.name)}`;
  await bucket.put(key, await value.arrayBuffer(), {
    httpMetadata: { contentType: value.type || "application/octet-stream" },
    customMetadata: { originalName: value.name },
  });
  return key;
}

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return unauthorized();
  return Response.json({ songs: await listAdminSongs() });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return unauthorized();
  try {
    const form = await request.formData();
    const input = parseSongForm(form);
    input.coverKey = await uploadFile(form, "cover", "covers");
    input.pdfKey = await uploadFile(form, "pdf", "pdfs");
    const song = await createSong(input);
    return Response.json({ song }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить разбор.";
    return Response.json({ error: message }, { status: 400 });
  }
}
