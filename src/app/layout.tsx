import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/ui/Navbar";

export const metadata: Metadata = {
  title: "QRDrop — Zero-Network P2P Optical File Transfer",
  description:
    "100% offline peer-to-peer file transfer over high-speed QR stream. No Wi-Fi, Bluetooth, cables, cloud servers, or internet required.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-512.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950">
        <Navbar />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col">
          {children}
        </main>
        <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 space-y-1">
          <p>
            QRDrop • 100% Offline Optical P2P • Screen → Camera Communication
          </p>
          <p className="text-[11px] text-slate-600">
            Zero telemetry • No external servers • End-to-end Web Crypto AES-256-GCM
          </p>
        </footer>

        {/* Client-side Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(err => {
                    console.log('Service Worker registration skipped:', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
