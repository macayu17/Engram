import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

function passThroughMiddleware() {
  return NextResponse.next();
}

const isProductRoute = createRouteMatcher([
  "/overview(.*)",
  "/memories(.*)",
  "/chat(.*)",
  "/logs(.*)",
  "/graph(.*)",
  "/settings(.*)",
]);

export default clerkPublishableKey
  ? clerkMiddleware(async (auth, request) => {
      if (isProductRoute(request)) {
        await auth.protect();
      }
    })
  : passThroughMiddleware;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
