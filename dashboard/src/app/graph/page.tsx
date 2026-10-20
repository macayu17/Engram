import { MemoryGraph } from "@/components/MemoryGraph";

export default function GraphPage() {
  return <><p className="mb-5 text-sm text-muted">Workspace graph: entities span all projects in this account.</p><MemoryGraph /></>;
}
