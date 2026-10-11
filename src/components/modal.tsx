"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons";

/** A native <dialog>: focus trapping, Escape and the backdrop come from the browser. */
export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
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
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl border border-line-2 bg-bg-2 p-0 text-fg shadow-[var(--shadow)] backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-[rise_320ms_var(--ease)_both]`}
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold">{title}</h2>
            <button className="btn btn-ghost btn-icon -mr-2" onClick={onClose} aria-label="Close">
              <Icon name="x" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
