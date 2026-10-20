"use client";

import { ReactNode, useEffect, useRef } from "react";

export function ProductDialog({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg border border-line bg-panel p-0 text-ink backdrop:bg-black/40"
    >
      {children}
    </dialog>
  );
}
