import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function assertCheck(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
}

const packageJson = JSON.parse(read("package.json"));
const proxyPath = existsSync(join(root, "src", "proxy.ts")) ? "src/proxy.ts" : "proxy.ts";
const proxySource = existsSync(join(root, proxyPath)) ? read(proxyPath) : "";
const layoutSource = read("src/app/layout.tsx");
const apiSource = read("src/lib/api.ts");
const bridgePath = "src/components/ClerkEngramBridge.tsx";
const bridgeSource = existsSync(join(root, bridgePath)) ? read(bridgePath) : "";

assertCheck("depends on @clerk/nextjs", Boolean(packageJson.dependencies?.["@clerk/nextjs"]));
assertCheck("has proxy.ts", Boolean(proxySource));
assertCheck("uses clerkMiddleware", proxySource.includes("clerkMiddleware()"));
assertCheck("imports middleware from server package", proxySource.includes("from \"@clerk/nextjs/server\"") || proxySource.includes("from '@clerk/nextjs/server'"));
assertCheck("proxy guards missing publishable key", proxySource.includes("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") && proxySource.includes("NextResponse.next()"));
assertCheck("does not use authMiddleware", !proxySource.includes("authMiddleware"));
assertCheck("imports Clerk components", layoutSource.includes("ClerkProvider") && layoutSource.includes("Show") && layoutSource.includes("SignInButton") && layoutSource.includes("SignUpButton") && layoutSource.includes("UserButton"));
assertCheck("imports from @clerk/nextjs", layoutSource.includes("from \"@clerk/nextjs\"") || layoutSource.includes("from '@clerk/nextjs'"));
assertCheck("places ClerkProvider inside body", layoutSource.indexOf("<body") !== -1 && layoutSource.indexOf("<ClerkProvider") > layoutSource.indexOf("<body"));
assertCheck("guards missing publishable key", layoutSource.includes("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") && layoutSource.includes("Auth Not Configured"));
assertCheck("uses Show components", layoutSource.includes("<Show when=\"signed-out\">") && layoutSource.includes("<Show when=\"signed-in\">"));
assertCheck("does not use deprecated signed components", !layoutSource.includes("SignedIn") && !layoutSource.includes("SignedOut"));
assertCheck("renders Clerk Engram bridge", layoutSource.includes("ClerkEngramBridge"));
assertCheck("has Clerk Engram bridge component", Boolean(bridgeSource));
assertCheck("bridge reads Clerk user", bridgeSource.includes("useUser") && bridgeSource.includes("from \"@clerk/nextjs\""));
assertCheck("bridge creates Engram user", bridgeSource.includes("api.users.create"));
assertCheck("bridge scopes API key by Clerk user", bridgeSource.includes("readClerkApiKey") && bridgeSource.includes("setClerkApiKey") && apiSource.includes("engram_api_key:clerk:"));
assertCheck("bridge clears active key when signed out", bridgeSource.includes("clearActiveApiKey"));

const failedChecks = checks.filter((check) => !check.passed);

for (const check of checks) {
  process.stdout.write(`${check.passed ? "PASS" : "FAIL"} ${check.name}\n`);
}

if (failedChecks.length) {
  process.exitCode = 1;
}
