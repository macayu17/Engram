import { AlertTriangle } from "lucide-react";

import { type MemoryConflict, type MemoryConflictResolution } from "@/lib/api";


type MemoryConflictReviewProps = {
  conflict: MemoryConflict;
  disabled: boolean;
  onResolve: (conflictId: string, resolution: MemoryConflictResolution) => void;
};

export function MemoryConflictReview({ conflict, disabled, onResolve }: MemoryConflictReviewProps) {
  return (
    <article className="border-b border-line py-6 last:border-b-0">
      <div className="flex items-center gap-2 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-fault">
        <AlertTriangle size={15} aria-hidden="true" />
        Contradiction detected
      </div>
      <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2">
        <MemoryClaim label="Current memory" content={conflict.existing_memory.content} />
        <MemoryClaim label="Proposed memory" content={conflict.proposed_memory.content} accent />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ResolutionButton
          label="Use new"
          disabled={disabled}
          onClick={() => onResolve(conflict.id, "accept_new")}
          primary
        />
        <ResolutionButton
          label="Keep current"
          disabled={disabled}
          onClick={() => onResolve(conflict.id, "keep_old")}
        />
        <ResolutionButton
          label="Keep both"
          disabled={disabled}
          onClick={() => onResolve(conflict.id, "keep_both")}
        />
      </div>
    </article>
  );
}

function MemoryClaim({ label, content, accent = false }: { label: string; content: string; accent?: boolean }) {
  return (
    <div className="bg-panel p-4">
      <p className={`font-sans text-[10px] font-medium uppercase tracking-[0.12em] ${accent ? "text-signal" : "text-muted"}`}>{label}</p>
      <p className="mt-2 font-serif text-base leading-6 text-ink">{content}</p>
    </div>
  );
}

function ResolutionButton({
  label,
  disabled,
  onClick,
  primary = false,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-9 rounded-full border px-4 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] transition active:translate-y-px disabled:cursor-wait disabled:opacity-50 ${
        primary
          ? "border-signal bg-signal text-paper hover:border-ink hover:bg-ink"
          : "border-line text-muted hover:border-signal hover:text-signal"
      }`}
    >
      {label}
    </button>
  );
}
