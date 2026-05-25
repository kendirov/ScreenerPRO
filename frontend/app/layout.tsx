import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/app/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Лаборатория рынка — ScreenerPRO",
  description: "Интерактивная лаборатория рынка MOEX: скринер, материалы и эксперименты ScreenerPRO.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="lab-shell min-h-full bg-lab-bg text-lab-text-main antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
