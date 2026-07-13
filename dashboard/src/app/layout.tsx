import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";

import { AppFrame } from "@/components/AppFrame";
import { Providers } from "@/components/Providers";
import "./globals.css";

const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Engram | Self-hostable AI memory",
  description: "Open-source memory infrastructure for AI products, with inspectable retrieval and MCP support.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${newsreader.variable} ${geist.variable} ${geistMono.variable} min-h-screen bg-paper text-ink antialiased`}>
        {clerkPublishableKey ? (
          <ClerkProvider publishableKey={clerkPublishableKey}>
            <Providers>
              <AppFrame authEnabled>{children}</AppFrame>
            </Providers>
          </ClerkProvider>
        ) : (
          <Providers>
            <AppFrame authEnabled={false}>{children}</AppFrame>
          </Providers>
        )}
      </body>
    </html>
  );
}
