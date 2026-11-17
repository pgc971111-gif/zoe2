"use client";
import { usePathname } from "next/navigation";
import Sidebar from "../components/Sidebar";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/"; // Oculta el menú en la portada principal

  return (
    <html lang="es">
      <body style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--zoe-bg)", margin: 0 }}>
        {!isLanding && <Sidebar />}
        <main style={{ flex: 1, padding: !isLanding ? "2rem" : "0", overflowY: "auto", height: "100vh" }}>
          {children}
        </main>
      </body>
    </html>
  );
}