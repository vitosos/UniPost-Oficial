import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "UniPost", template: "%s · UniPost" },
  description: "Publica, programa y mide tus redes sociales desde un solo panel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: "#0f172a", color: "#e2e8f0", border: "1px solid rgb(255 255 255 / 0.1)", borderRadius: "12px", fontSize: "14px" },
          }}
        />
      </body>
    </html>
  );
}
