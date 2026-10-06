import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Control Center",
  description: "Private family infrastructure and device operations center",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
