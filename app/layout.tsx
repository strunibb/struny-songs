import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Струны будущего — разборы песен на гитаре",
  description: "Готовые разборы любимых песен: подробное видео, PDF, аккорды, бой, риффы и фингерстайл.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
