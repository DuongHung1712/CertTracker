import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { StyleProvider, STYLE_INIT_SCRIPT } from "@/components/style-provider";
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
  description: "Certificate tracking for your team",
  // No `icons` here: an explicit `icons` disables Next's file-convention icons
  // (src/app/icon.svg, src/app/favicon.ico), which are served with cache-busting hashes.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-style="classic"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: STYLE_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <StyleProvider defaultStyle="classic">
            <TooltipProvider delay={200}>{children}</TooltipProvider>
            <Toaster
              position="top-center"
              offset={{ top: 56 }}
              mobileOffset={{ top: 56, left: 16, right: 16 }}
              closeButton
              toastOptions={{ closeButtonAriaLabel: "Close notification" }}
            />
          </StyleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
