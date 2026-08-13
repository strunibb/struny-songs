import { listPublicSongs } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ songs: await listPublicSongs() });
  } catch {
    return Response.json({ error: "Не удалось загрузить каталог." }, { status: 500 });
  }
}
