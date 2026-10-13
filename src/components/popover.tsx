"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** A small menu that grows out of the button that opened it. */
export function Popover({
  trigger,
  children,
  align = "left",
  label,
  width = 280,
}: {
  trigger: (p: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  label: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={label}
            className={`glass-strong absolute top-[calc(100%+8px)] z-50 rounded-[20px] p-1.5 ${align === "right" ? "right-0" : "left-0"}`}
            style={{ width, transformOrigin: align === "right" ? "top right" : "top left" }}
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.14 } }}
            transition={{ type: "spring", bounce: 0.16, duration: 0.38 }}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MenuItem({ children, onClick, href, danger = false }: { children: ReactNode; onClick?: () => void; href?: string; danger?: boolean }) {
  const cls = `row flex w-full items-center gap-2.5 rounded-[13px] px-3 py-2 text-left text-[14px] ${danger ? "text-danger" : ""}`;
  return href ? (
    <Link href={href} className={cls} role="menuitem" onClick={onClick}>
      {children}
    </Link>
  ) : (
    <button type="button" className={cls} role="menuitem" onClick={onClick}>
      {children}
    </button>
  );
}
