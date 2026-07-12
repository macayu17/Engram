import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";


const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const rootLayout = read("src/app/layout.tsx");
const marketingLayout = read("src/app/(marketing)/layout.tsx");
const productLayout = read("src/app/(product)/layout.tsx");
const publicPage = read("src/app/(marketing)/page.tsx");
const landingPage = read("src/components/LandingPage.tsx");
const css = read("src/app/globals.css");

assert.doesNotMatch(rootLayout, /CommandPalette|ClerkEngramBridge|DashboardShell/, "Root layout must not mount product UI");
assert.doesNotMatch(marketingLayout, /@\/lib\/api/, "Marketing layout must not call the Engram API");
assert.match(productLayout, /ClerkEngramBridge/, "Product layout must mount the Clerk bridge");
assert.match(productLayout, /ProductShell/, "Product layout must mount the product shell");
assert.doesNotMatch(css, /memory-hero-orbit|memory-constellation/, "Obsolete decorative visuals must be removed");
assert.doesNotMatch(publicPage, /HomeDashboard|@\/lib\/api|useQuery|engram_api_key/, "Public root must remain API-free");
assert.match(landingPage, /Memory infrastructure for AI products/, "Public root must state the product category");

console.log("Route layout verification passed");
