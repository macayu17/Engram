import Link from "next/link";

import { AsciiScene } from "@/components/site/AsciiScene";
import { CodeBlock } from "@/components/site/CodeBlock";
import { band, button, displayLg, displayXl, eyebrow, lead, pageWrap } from "@/lib/site-styles";

export const metadata = {
  title: "About · Engram",
  description: "Engram gives language models a long-term memory you can read, review and run yourself.",
};

const principles = [
  {
    claim: "Every retrieval is logged.",
    detail: "The query, the memory snapshots, their scores, and how many reached the prompt. You can always see why a fact was used.",
    proof: "GET /logs/{id}",
  },
  {
    claim: "Nothing is recalled until you approve it.",
    detail: "Extracted facts wait in the review queue. Updates arrive as revisions, and earlier versions stay restorable.",
    proof: 'PATCH /memories/{id} {"status": "approved"}',
  },
  {
    claim: "Weak matches stay out.",
    detail: "A few facts close to the best match, at the top of the system prompt. Everything else is skipped.",
    proof: "RETRIEVAL_THRESHOLD=0.3",
  },
  {
    claim: "Your keys, your database, your machine.",
    detail: "MIT licensed. Embeddings run locally, and provider keys are your own, encrypted at rest.",
    proof: "docker compose up -d",
  },
];

const services = `# NAME      IMAGE                    PORT
api         engram-api               8000   # FastAPI proxy + REST
postgres    pgvector/pgvector:pg16   5432   # memories + vectors
mcp         engram-mcp               3000   # MCP server (engramd)
dashboard   engram-dashboard         3001   # Next.js console
4 services running`;

export default function AboutPage() {
  return (
    <div className={pageWrap}>
      <section className="grid items-center gap-12 pb-[72px] pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 [&>*]:min-w-0">
        <div>
          <span className={eyebrow}>about</span>
          <h1 className={displayXl}>
            Memory you can <em>read</em>.
          </h1>
          <p className={lead}>
            Language models forget everything between requests. Engram gives them a long-term memory that lives in your Postgres, that you can inspect line by line, and that only learns what you approve.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <a href="https://github.com/macayu17/Engram" target="_blank" rel="noopener noreferrer" className={button.ink}>
              View the source
            </a>
            <Link href="/docs" className={button.line}>
              Read the docs
            </Link>
          </div>
        </div>
        <AsciiScene scene="helix" label="A double helix with memories on its rungs and a recall pulse." />
      </section>

      <section className={`${band} !pt-14`}>
        <span className={eyebrow}>principles</span>
        <h2 className={displayLg}>What Engram will and won&apos;t do.</h2>
        <ol className="m-0 mt-9 flex list-none flex-col gap-10 p-0">
          {principles.map((item, index) => (
            <li key={item.claim} className="grid gap-x-7 gap-y-1 lg:grid-cols-[56px_minmax(0,1fr)_minmax(0,auto)] lg:items-baseline">
              <span className="font-mono text-xs text-hot-ink lg:row-span-2 lg:pt-3.5">0{index + 1}</span>
              <p className="m-0 font-display text-[clamp(26px,3vw,36px)] leading-[1.1] tracking-[-0.015em] text-ink lg:col-start-2">{item.claim}</p>
              <p className="m-0 max-w-[52ch] text-ink-muted lg:col-start-2">{item.detail}</p>
              <code className="mt-2 justify-self-start rounded-sm bg-tint px-2.5 py-1.5 font-mono text-xs text-ink lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:self-center lg:whitespace-nowrap">
                {item.proof}
              </code>
            </li>
          ))}
        </ol>
      </section>

      <section className={band}>
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 [&>*]:min-w-0">
          <div>
            <span className={eyebrow}>built with</span>
            <h2 className="mt-3 font-display text-[30px] font-normal leading-[1.12] tracking-[-0.015em]">Four services, one compose file.</h2>
          </div>
          <CodeBlock title="docker compose ps" code={services} accent="4 services running" copyable={false} />
        </div>
      </section>
    </div>
  );
}
