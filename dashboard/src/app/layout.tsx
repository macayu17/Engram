import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist_Mono, Hanken_Grotesk, Newsreader } from "next/font/google";

import { AppFrame } from "@/components/AppFrame";
import { Providers } from "@/components/Providers";
import { RouteLoader } from "@/components/site/RouteLoader";
import "./globals.css";

const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const display = Newsreader({ subsets: ["latin"], variable: "--font-display", display: "swap", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Engram · memory for your models",
  description: "A quiet, self-hostable memory layer for LLM apps. Inspectable retrieval, human review, and MCP support.",
};

const themeScript = `try{var t=localStorage.getItem("engram_theme");if(t==="cobalt")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const app = (
    <Providers>
      <RouteLoader />
      <AppFrame authEnabled={Boolean(clerkPublishableKey)}>{children}</AppFrame>
    </Providers>
  );

  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${display.variable} min-h-screen bg-paper font-sans text-ink antialiased`}>
        {clerkPublishableKey ? <ClerkProvider publishableKey={clerkPublishableKey}>{app}</ClerkProvider> : app}
      </body>
    </html>
  );
}
