import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Observability Platform",
  description: "AI-Powered Cloud Observability Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
