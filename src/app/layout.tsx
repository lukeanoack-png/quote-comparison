import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store/app-context";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Supplier Quote Comparison",
  description: "Compare supplier quotes on true economic cost, not just sticker price.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <AppProvider>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        </AppProvider>
      </body>
    </html>
  );
}
