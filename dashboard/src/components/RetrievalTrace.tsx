const TRACE = {
  request: "What stack should I use for the new API?",
  memories: [
    { content: "Prefers FastAPI for Python backends", score: 0.91 },
    { content: "Uses TypeScript for frontend work", score: 0.84 },
  ],
  context: "[MEMORY CONTEXT]\n- Prefers FastAPI for Python backends\n- Uses TypeScript for frontend work",
  response: "Use FastAPI for the API and TypeScript for the client.",
};

export function RetrievalTrace() {
  return (
    <div className="min-w-0 max-w-full overflow-hidden border border-line bg-panel">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <p className="shrink-0 text-sm font-semibold text-ink">Retrieval trace</p>
        <p className="min-w-0 truncate font-mono text-xs text-muted">example trace</p>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] divide-y divide-line lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        <TraceStep index="01" label="Request"><p className="text-sm leading-6 text-ink">{TRACE.request}</p></TraceStep>
        <TraceStep index="02" label="Retrieved memories">
          <ul className="space-y-3">{TRACE.memories.map((memory) => <li key={memory.content}><div className="flex gap-3"><span className="font-mono text-xs font-semibold text-signal">{memory.score.toFixed(2)}</span><span className="text-sm leading-5 text-ink">{memory.content}</span></div></li>)}</ul>
        </TraceStep>
        <TraceStep index="03" label="Injected context"><pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-5 text-muted">{TRACE.context}</pre></TraceStep>
        <TraceStep index="04" label="Model response"><p className="text-sm leading-6 text-ink">{TRACE.response}</p></TraceStep>
      </div>
    </div>
  );
}

function TraceStep({ index, label, children }: { index: string; label: string; children: React.ReactNode }) {
  return <section className="min-w-0 p-4 sm:p-5"><div className="mb-4 flex items-center gap-2"><span className="font-mono text-[11px] text-signal">{index}</span><h3 className="text-xs font-semibold uppercase text-muted">{label}</h3></div>{children}</section>;
}
