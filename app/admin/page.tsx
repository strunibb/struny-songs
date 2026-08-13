import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLogin } from "@/components/admin-login";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin-auth";
import { listAdminSongs } from "@/lib/database";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Админка — Струны будущего", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const authenticated = await verifyAdminSession(token);
  return authenticated ? <AdminDashboard initialSongs={await listAdminSongs()} /> : <AdminLogin />;
}
