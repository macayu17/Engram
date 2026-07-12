import fs from "node:fs";
import path from "node:path";
import process from "node:process";


const root = process.cwd();
const routePaths = [
  "src/app/api/billing/checkout/route.ts",
  "src/app/api/billing/portal/route.ts",
];

for (const relativePath of routePaths) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing billing route: ${relativePath}`);
  }
  const source = fs.readFileSync(absolutePath, "utf8");
  if (!source.includes('import { auth } from "@clerk/nextjs/server"')) {
    throw new Error(`${relativePath} must use Clerk server auth`);
  }
  if (!source.includes("if (!userId)")) {
    throw new Error(`${relativePath} must reject missing Clerk users`);
  }
  if (!source.includes('"X-Engram-Service-Key": serviceKey')) {
    throw new Error(`${relativePath} must send the Engram service key`);
  }
  if (!source.includes("external_id: `clerk:${userId}`")) {
    throw new Error(`${relativePath} must derive external_id from Clerk`);
  }
  if (source.includes("body.external_id") || source.includes("body.externalId")) {
    throw new Error(`${relativePath} must not accept browser-supplied identity`);
  }
}

console.log("Billing bridge verification passed");
