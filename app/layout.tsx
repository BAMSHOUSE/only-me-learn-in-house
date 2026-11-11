import type { Metadata } from "next";
import "./globals.css";
import "./canva-ui.css";
import "./months.css";
import "./steps.css";
import "./readability.css";
import "./push.css";
import "./electric-lime.css";
import "./polish.css";
import "./ui-ux-pro.css";

export const metadata: Metadata = {
  title: "Only Me Learn in House — Course Ops",
  description: "ติดตามการผลิตคอร์สเรียน พร้อมสถานะงาน การอนุมัติ และประวัติการทำงาน",
  icons: {
    icon: "/only-me-learn-logo.png",
    shortcut: "/only-me-learn-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
