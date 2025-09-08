import "./globals.css";
import type { Metadata } from "next";
import { AppThemeProvider } from "@/components/AppThemeProvider";
import { Header } from "@/components/Header";
import { FooterNav } from "@/components/FooterNav";

export const metadata: Metadata = {
  title: "Wukong 100% — Guide & Tracker",
  description: "A modern, responsive checklist + guide for Black Myth: Wukong collectibles."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppThemeProvider>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 container mx-auto px-4 py-6 pb-24 sm:pb-6">{children}</main>
            <FooterNav />
            <footer className="hidden sm:block container mx-auto px-4 py-6 text-xs text-neutral-400">
              Data saved locally • Export often before starting NG+
            </footer>
          </div>
        </AppThemeProvider>
      </body>
    </html>
  );
}


