import { ClerkEngramBridge } from "@/components/ClerkEngramBridge";
import { ProductShell } from "@/components/ProductShell";


export default function ProductLayout({ children }: { children: React.ReactNode }) {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  return (
    <>
      {authEnabled && <ClerkEngramBridge />}
      <ProductShell authEnabled={authEnabled}>{children}</ProductShell>
    </>
  );
}
