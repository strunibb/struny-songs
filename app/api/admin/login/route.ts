import { ADMIN_COOKIE, adminCookieOptions, createAdminSession, verifyAdminPassword } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { password?: string } | null;
  if (!payload?.password || !(await verifyAdminPassword(payload.password))) {
    return Response.json({ error: "Неверный пароль." }, { status: 401 });
  }

  const token = await createAdminSession();
  const options = adminCookieOptions;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const cookie = `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=${options.path}; HttpOnly${secure}; SameSite=Lax; Max-Age=${options.maxAge}`;
  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
}
