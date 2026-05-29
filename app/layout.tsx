import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DockPass",
  description: "แดชบอร์ดเช็กอินรอบงานหรือทริปแบบเบา ใช้งานง่าย และพร้อมนำขึ้นใช้งานบน Vercel"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
