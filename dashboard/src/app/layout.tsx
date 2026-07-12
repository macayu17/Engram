import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";

import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Engram | Memory infrastructure for AI products",
    template: "%s | Engram",
  },
  description: "Store, retrieve, and inspect durable memory for AI applications.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const content = <Providers>{children}</Providers>;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-[100dvh] bg-paper text-ink antialiased">
        {clerkPublishableKey ? (
          <ClerkProvider publishableKey={clerkPublishableKey}>{content}</ClerkProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}
