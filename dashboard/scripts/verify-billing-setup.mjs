import fs from "node:fs";
import path from "node:path";
import process from "node:process";


const root = process.cwd();
const repositoryRoot = path.resolve(root, "..");
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

const requiredBillingVariables = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_PRICE_ID",
  "DASHBOARD_URL",
];
const environmentExample = fs.readFileSync(path.join(repositoryRoot, ".env.example"), "utf8");
const composeFiles = ["docker-compose.yml", "docker-compose.supabase.yml"];

for (const variable of requiredBillingVariables) {
  if (!environmentExample.includes(`${variable}=`)) {
    throw new Error(`.env.example must include ${variable}`);
  }
  for (const composeFile of composeFiles) {
    const composeSource = fs.readFileSync(path.join(repositoryRoot, composeFile), "utf8");
    if (!composeSource.includes(`${variable}: \${${variable}`)) {
      throw new Error(`${composeFile} must pass ${variable} to the API`);
    }
  }
}

console.log("Billing bridge verification passed");
