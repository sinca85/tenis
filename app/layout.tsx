import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tenis | Santivillabrile",
  description: "Disponibilidad de canchas de tenis en Neptunia",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
