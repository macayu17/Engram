import { Suspense } from "react";

import { ConnectionConsent } from "@/components/ConnectionConsent";

export default function ConnectionAuthorizePage() {
  return <Suspense fallback={<p role="status">Loading connection request...</p>}><ConnectionConsent /></Suspense>;
}
