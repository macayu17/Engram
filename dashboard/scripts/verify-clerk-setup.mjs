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
const appFrameSource = read("src/components/AppFrame.tsx");
const authControlsSource = read("src/components/AuthControls.tsx");
const apiSource = read("src/lib/api.ts");
const bridgePath = "src/components/ClerkEngramBridge.tsx";
const bridgeSource = existsSync(join(root, bridgePath)) ? read(bridgePath) : "";
const clerkRoutePath = "src/app/api/engram/user-key/route.ts";
const clerkRouteSource = existsSync(join(root, clerkRoutePath)) ? read(clerkRoutePath) : "";
const manualUserRoutePath = "src/app/api/engram/users/route.ts";
const manualUserRouteSource = existsSync(join(root, manualUserRoutePath)) ? read(manualUserRoutePath) : "";
const missingAuthLabel = ["Auth", "Not", "Configured"].join(" ");

assertCheck("depends on @clerk/nextjs", Boolean(packageJson.dependencies?.["@clerk/nextjs"]));
assertCheck("has proxy.ts", Boolean(proxySource));
assertCheck("uses clerkMiddleware", proxySource.includes("clerkMiddleware("));
assertCheck("uses Clerk route matcher", proxySource.includes("createRouteMatcher"));
assertCheck("protects product routes", proxySource.includes("/overview(.*)") && proxySource.includes("/memories(.*)") && proxySource.includes("await auth.protect()"));
assertCheck("guards missing middleware key", proxySource.includes("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") && proxySource.includes("NextResponse.next"));
assertCheck("imports middleware from server package", proxySource.includes("from \"@clerk/nextjs/server\"") || proxySource.includes("from '@clerk/nextjs/server'"));
assertCheck("does not use authMiddleware", !proxySource.includes("authMiddleware"));
assertCheck("imports Clerk provider in layout", layoutSource.includes("ClerkProvider"));
assertCheck("uses client Clerk components", authControlsSource.includes("\"use client\"") && authControlsSource.includes("Show") && authControlsSource.includes("SignInButton") && authControlsSource.includes("UserButton"));
assertCheck("imports from @clerk/nextjs", layoutSource.includes("from \"@clerk/nextjs\"") || layoutSource.includes("from '@clerk/nextjs'"));
assertCheck("auth controls import from @clerk/nextjs", authControlsSource.includes("from \"@clerk/nextjs\"") || authControlsSource.includes("from '@clerk/nextjs'"));
assertCheck("places ClerkProvider inside body", layoutSource.indexOf("<body") !== -1 && layoutSource.indexOf("<ClerkProvider") > layoutSource.indexOf("<body"));
assertCheck("guards missing publishable key", layoutSource.includes("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") && layoutSource.includes("authEnabled={false}"));
assertCheck("hides missing publishable key warning", !layoutSource.includes(missingAuthLabel));
assertCheck("uses Show components", authControlsSource.includes("<Show when=\"signed-out\">") && authControlsSource.includes("<Show when=\"signed-in\">"));
assertCheck("uses one signed-out auth action", authControlsSource.includes("SignInButton") && !authControlsSource.includes("SignUpButton"));
assertCheck("does not use deprecated signed components", !layoutSource.includes("SignedIn") && !layoutSource.includes("SignedOut") && !authControlsSource.includes("SignedIn") && !authControlsSource.includes("SignedOut"));
assertCheck("renders route-aware app frame", layoutSource.includes("AppFrame"));
assertCheck("renders Clerk Engram bridge", appFrameSource.includes("ClerkEngramBridge") && appFrameSource.includes("authEnabled &&"));
assertCheck("has Clerk Engram bridge component", Boolean(bridgeSource));
assertCheck("bridge reads Clerk user", bridgeSource.includes("useUser") && bridgeSource.includes("from \"@clerk/nextjs\""));
assertCheck("bridge ensures Engram user key", bridgeSource.includes("api.users.ensureClerkKey"));
assertCheck("bridge scopes API key by Clerk user", bridgeSource.includes("readClerkApiKey") && bridgeSource.includes("setClerkApiKey") && apiSource.includes("engram_api_key:clerk:"));
assertCheck("bridge clears active key when signed out", bridgeSource.includes("clearActiveApiKey"));
assertCheck("has Clerk key server route", Boolean(clerkRouteSource));
assertCheck("server route uses Clerk auth", clerkRouteSource.includes("auth()") && clerkRouteSource.includes("from \"@clerk/nextjs/server\""));
assertCheck("server route uses service key", clerkRouteSource.includes("ENGRAM_SERVICE_KEY") && clerkRouteSource.includes("X-Engram-Service-Key"));
assertCheck("server route requires Clerk session", clerkRouteSource.includes("sessionId") && clerkRouteSource.includes("!userId || !sessionId"));
assertCheck("server route derives session key name", clerkRouteSource.includes("key_name: `clerk:${sessionId}`"));
assertCheck("server route sends workspace name", clerkRouteSource.includes("workspace_name: \"Personal workspace\""));
assertCheck("server route returns workspace metadata", clerkRouteSource.includes("workspaceId") && clerkRouteSource.includes("workspaceName") && clerkRouteSource.includes("role"));
assertCheck("manual user route blocks hosted creation", manualUserRouteSource.includes("if (serviceKey)") && manualUserRouteSource.includes("status: 404"));
assertCheck("manual user route never forwards service key", !manualUserRouteSource.includes('"/users/service-key"') && !manualUserRouteSource.includes('"X-Engram-Service-Key"'));

const failedChecks = checks.filter((check) => !check.passed);

for (const check of checks) {
  process.stdout.write(`${check.passed ? "PASS" : "FAIL"} ${check.name}\n`);
}

if (failedChecks.length) {
  process.exitCode = 1;
}
