"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";

/**
 * A sheet: a native <dialog> (focus trap, Escape and backdrop for free) that
 * materialises in the middle on a desktop and slides up from the bottom on a
 * phone. Content stays mounted while it animates out.
 */
export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [round, setRound] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setRound((r) => r + 1); // fresh form state every time it opens
  }
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`sheet ${wide ? "max-w-[680px]" : "max-w-[520px]"}`}
      aria-label={title}
    >
      <div key={round} className="p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-[640] tracking-[-0.025em]">{title}</h2>
          <button className="btn btn-ghost btn-icon -mr-2 bg-surface-3/60" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} bold />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
