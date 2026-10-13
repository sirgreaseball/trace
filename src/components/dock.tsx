"use client";

import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Icon, type IconName } from "./icons";

export type DockItem = { href: string; label: string; icon: IconName; key: string; badge?: number; phone?: boolean };

/*
  The dock. On a desktop it floats at the bottom and swells under the pointer
  like the macOS dock; on a phone it is a plain tab bar with a More sheet.
*/
export function Dock({ items, tail, isActive }: { items: DockItem[]; tail: DockItem[]; isActive: (href: string) => boolean }) {
  const mouseX = useMotionValue(Infinity);
  return (
    <>
      <nav aria-label="Workspace" className="print-hide fixed inset-x-0 bottom-[max(14px,env(safe-area-inset-bottom))] z-40 hidden justify-center px-4 sm:flex">
        <motion.div
          onMouseMove={(e) => mouseX.set(e.clientX)}
          onMouseLeave={() => mouseX.set(Infinity)}
          className="glass-strong flex h-[62px] items-end gap-1 rounded-[24px] px-2 pb-[9px]"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.9, delay: 0.15 }}
        >
          {items.map((it) => (
            <DockIcon key={it.href} item={it} mouseX={mouseX} active={isActive(it.href)} />
          ))}
          <span className="mx-1 mb-1 h-8 w-px self-end bg-line-2" aria-hidden />
          {tail.map((it) => (
            <DockIcon key={it.href} item={it} mouseX={mouseX} active={isActive(it.href)} />
          ))}
        </motion.div>
      </nav>
      <PhoneBar items={[...items, ...tail]} isActive={isActive} />
    </>
  );
}

function DockIcon({ item, mouseX, active }: { item: DockItem; mouseX: MotionValue<number>; active: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const distance = useTransform(mouseX, (x) => {
    const b = ref.current?.getBoundingClientRect();
    return b ? x - b.left - b.width / 2 : Infinity;
  });
  const target = useTransform(distance, [-150, 0, 150], [44, 62, 44]);
  const size = useSpring(target, { mass: 0.12, stiffness: 190, damping: 15 });
  const icon = useTransform(size, [44, 62], [21, 27]);
  const lift = useTransform(size, [44, 62], [0, -7]);

  return (
    <motion.span style={{ width: size, height: size, y: lift }} className="group relative flex items-center justify-center">
      <Link
        ref={ref}
        href={item.href}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        className={`relative grid size-full place-items-center rounded-[15px] transition-colors duration-200 ${active ? "text-ink" : "text-ink-2 hover:text-ink"}`}
      >
        {active && (
          <motion.span
            layoutId="dock-lens"
            className="absolute inset-0 rounded-[15px] bg-[light-dark(#fff,rgb(255_255_255/0.12))] shadow-[0_1px_2px_rgb(0_0_0/0.08),0_6px_16px_-6px_rgb(0_0_0/0.2),inset_0_1px_0_rgb(255_255_255/0.6)]"
            transition={{ type: "spring", bounce: 0.18, duration: 0.55 }}
          />
        )}
        <motion.span style={{ width: icon, height: icon }} className="relative grid place-items-center">
          <Icon name={item.icon} size={64} weight={active ? "fill" : "regular"} className="size-full" />
        </motion.span>
        {!!item.badge && (
          <span className="num absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10.5px] font-semibold text-white shadow-[0_0_0_2px_var(--surface)]">
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
      </Link>
      <span className="glass-strong pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 translate-y-1 rounded-[10px] px-2.5 py-1 text-[12px] font-medium whitespace-nowrap opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-150">
        {item.label}
      </span>
      {active && <span className="absolute -bottom-[7px] size-1 rounded-full bg-ink-2" aria-hidden />}
    </motion.span>
  );
}

function PhoneBar({ items, isActive }: { items: DockItem[]; isActive: (href: string) => boolean }) {
  const [more, setMore] = useState(false);
  const main = items.filter((i) => i.phone);
  const rest = items.filter((i) => !i.phone);
  const restActive = rest.some((i) => isActive(i.href));
  return (
    <>
      <nav aria-label="Workspace" className="print-hide fixed inset-x-0 bottom-0 z-40 sm:hidden">
        <div className="glass-strong flex items-stretch justify-around rounded-none px-1 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))]">
          {main.map((it) => {
            const on = isActive(it.href);
            return (
              <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined} className={`press relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1 text-[10.5px] font-medium ${on ? "text-ink" : "text-ink-3"}`}>
                <span className="relative">
                  <Icon name={it.icon} size={24} weight={on ? "fill" : "regular"} />
                  {!!it.badge && <span className="num absolute -top-1 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9.5px] font-semibold text-white">{it.badge}</span>}
                </span>
                {it.label}
              </Link>
            );
          })}
          <button onClick={() => setMore(true)} className={`press flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1 text-[10.5px] font-medium ${restActive ? "text-ink" : "text-ink-3"}`} aria-expanded={more}>
            <Icon name="more" size={24} weight={restActive ? "bold" : "regular"} />
            More
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {more && (
          <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="More pages">
            <motion.button
              className="absolute inset-0 bg-black/25"
              aria-label="Close"
              onClick={() => setMore(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="glass-strong absolute inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] rounded-[28px] p-2"
              initial={{ y: "110%" }}
              animate={{ y: 0 }}
              exit={{ y: "110%" }}
              transition={{ type: "spring", bounce: 0.12, duration: 0.5 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.6 }}
              onDragEnd={(_, i) => (i.offset.y > 80 || i.velocity.y > 400) && setMore(false)}
            >
              <span className="mx-auto mb-2 block h-1 w-9 rounded-full bg-line-3" aria-hidden />
              <ul className="grid grid-cols-3 gap-1">
                {rest.map((it) => (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={() => setMore(false)}
                      className={`press relative flex flex-col items-center gap-1.5 rounded-[18px] px-2 py-3.5 text-[12.5px] font-medium ${isActive(it.href) ? "bg-[light-dark(#fff,rgb(255_255_255/0.1))] text-ink shadow-sm" : "text-ink-2"}`}
                    >
                      <Icon name={it.icon} size={26} weight={isActive(it.href) ? "fill" : "regular"} />
                      {it.label}
                      {!!it.badge && <span className="num absolute top-2 right-4 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9.5px] font-semibold text-white">{it.badge}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
