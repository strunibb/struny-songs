import { ADMIN_COOKIE } from "@/lib/admin-auth";

export async function POST() {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } },
  );
}
