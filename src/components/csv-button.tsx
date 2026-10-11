"use client";

import { Icon } from "./icons";

const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function CsvButton({ rows, filename }: { rows: string[][]; filename: string }) {
  function download() {
    // BOM so Excel opens UTF-8 (curly quotes, ₹) correctly.
    const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <button onClick={download} className="btn">
      <Icon name="download" size={14} />
      Export CSV
    </button>
  );
}
