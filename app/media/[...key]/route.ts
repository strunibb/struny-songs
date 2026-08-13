import { getBucket } from "@/lib/database";

type Context = { params: Promise<{ key: string[] }> };

export async function GET(_request: Request, context: Context) {
  const key = (await context.params).key.map(decodeURIComponent).join("/");
  if (!key.startsWith("covers/")) return new Response("Not found", { status: 404 });
  const object = await getBucket()?.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=86400, stale-while-revalidate=604800");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
