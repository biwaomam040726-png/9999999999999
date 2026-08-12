import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Abstract Hero AR",
  description: "เกม WebAR ภาษาไทยสำหรับเรียนรู้แนวคิดเชิงนามธรรมผ่านการคัดแยกข้อมูลสำคัญ",
  applicationName: "Abstract Hero AR",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover", themeColor: "#070b1a" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="th"><body>{children}</body></html>; }
