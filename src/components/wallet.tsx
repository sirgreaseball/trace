"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Pass, type PassData } from "./pass";

const PEEK = 92;
const HEIGHT = 236;

/**
 * Everyone's receipt, stacked like passes in a wallet. Hover one and it lifts
 * while the ones in front step aside; open it and it becomes the receipt.
 */
export function Wallet({ passes, base }: { passes: (PassData & { uid: string })[]; base: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = passes.length;
  return (
    <ul className="relative" style={{ height: PEEK * Math.max(0, n - 1) + HEIGHT + 30 }} onMouseLeave={() => setHover(null)}>
      {passes.map((p, i) => {
        const lifted = hover === i;
        const pushed = hover !== null && i > hover;
        return (
          <motion.li
            key={p.uid}
            className="absolute inset-x-0"
            style={{ top: i * PEEK, zIndex: i + 1 }}
            initial={{ opacity: 0, y: 70, rotateX: -12 }}
            animate={{ opacity: 1, y: lifted ? -14 : pushed ? 34 : 0, rotateX: 0, scale: lifted ? 1.012 : 1 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.7, delay: hover === null ? 0.08 * i : 0 }}
            onHoverStart={() => setHover(i)}
          >
            <Link href={`${base}/receipts/${p.uid}`} className="block rounded-[26px] outline-offset-4" onFocus={() => setHover(i)} aria-label={`${p.name}'s receipt, ${Math.round(p.share * 100)}% of the work`}>
                <div>
                  <Pass p={p} style={{ height: HEIGHT }} />
                </div>
            </Link>
          </motion.li>
        );
      })}
    </ul>
  );
}
