import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Be_Vietnam_Pro({
  variable: "--font-geist-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CertTracker",
  description: "Quản lý chứng chỉ cho team",
  // No `icons` here: an explicit `icons` disables Next's file-convention icons
  // (src/app/icon.svg, src/app/favicon.ico), which are served with cache-busting hashes.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <TooltipProvider delay={200}>{children}</TooltipProvider>
        <Toaster
          theme="light"
          position="bottom-right"
          closeButton
          toastOptions={{ closeButtonAriaLabel: "Đóng thông báo" }}
        />
      </body>
    </html>
  );
}
