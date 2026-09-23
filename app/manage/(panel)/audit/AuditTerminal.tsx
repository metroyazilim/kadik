"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Maximize2, Minimize2, Terminal } from "lucide-react";
import { cn } from "@/components/admin/ui";

export type AuditTerminalLine = Readonly<{
  id: string;
  time: string;
  actor: string;
  action: string;
  description: string;
  target: string;
  details: string;
  tone: "success" | "danger" | "info" | "muted";
}>;

const TONE_CLASS: Record<AuditTerminalLine["tone"], string> = {
  success: "text-emerald-400",
  danger: "text-rose-400",
  info: "text-sky-400",
  muted: "text-neutral-400",
};

/** Case-insensitive in both Turkish and English ("PUBLISH" matches "publish", "İÇERİK" matches "içerik"). */
function normalize(value: string): string {
  return value.toLocaleLowerCase("tr").replace(/ı/g, "i");
}

/**
 * Audit log rendered as a terminal: oldest line at the top, newest at the
 * bottom (like `tail -f`), with a client-side `grep` over the loaded window
 * and cursor navigation for older/newer windows.
 */
export function AuditTerminal({
  lines,
  olderHref,
  newerHref,
  resetHref,
}: {
  lines: readonly AuditTerminalLine[];
  olderHref: string | null;
  newerHref: string | null;
  resetHref: string | null;
}) {
  const [query, setQuery] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return lines;
    return lines.filter((line) =>
      [line.time, line.actor, line.action, line.description, line.target, line.details].some((part) => normalize(part).includes(needle)),
    );
  }, [lines, query]);

  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [visible, fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const navLink = "rounded border border-neutral-700 px-2 py-0.5 text-neutral-300 transition-colors hover:border-emerald-500 hover:text-emerald-300";

  return (
    <section
      aria-label="Denetim kayıtları terminali"
      className={cn(
        "flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-950 font-mono text-[12px] text-neutral-200 shadow-xl",
        fullscreen ? "fixed inset-3 z-50" : "h-[70vh] min-h-[420px]",
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-900 px-3.5 py-2.5 select-none">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-block size-3 rounded-full bg-rose-500" aria-hidden="true" />
          <span className="inline-block size-3 rounded-full bg-amber-400" aria-hidden="true" />
          <span className="inline-block size-3 rounded-full bg-emerald-500" aria-hidden="true" />
          <Terminal className="ml-2 size-3.5 text-emerald-400" aria-hidden="true" />
          <span className="truncate text-neutral-300">kadik@panel: ~/logs/audit.log</span>
        </div>
        <button
          type="button"
          onClick={() => setFullscreen((value) => !value)}
          className="p-1 text-neutral-400 transition-colors hover:text-neutral-100"
          aria-label={fullscreen ? "Pencereyi küçült" : "Tam ekran"}
          title={fullscreen ? "Küçült (Esc)" : "Tam ekran"}
        >
          {fullscreen ? <Minimize2 className="size-3.5" aria-hidden="true" /> : <Maximize2 className="size-3.5" aria-hidden="true" />}
        </button>
      </header>

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3 leading-6" role="log" aria-live="polite">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-neutral-500">
          <span># {lines.length} kayıt yüklendi · eski kayıtlar üstte, en yenisi en altta</span>
          {newerHref ? (
            <Link href={newerHref} className={navLink}>
              ↓ daha yeni kayıtlar
            </Link>
          ) : null}
          {olderHref ? (
            <Link href={olderHref} className={navLink}>
              ↑ daha eski kayıtlar
            </Link>
          ) : null}
          {resetHref ? (
            <Link href={resetHref} className={navLink}>
              en son kayıtlara dön
            </Link>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <p className="text-neutral-500">{query ? `grep: "${query}" ile eşleşen kayıt yok` : "Kayıt bulunmuyor."}</p>
        ) : (
          <ol>
            {visible.map((line) => (
              <li key={line.id} className="group flex flex-wrap gap-x-3 rounded px-1 hover:bg-neutral-900">
                <span className="text-neutral-500">{line.time}</span>
                <span className="text-amber-300">{line.actor}</span>
                <span className={cn("font-bold", TONE_CLASS[line.tone])}>{line.action}</span>
                <span className="text-neutral-100">{line.description}</span>
                {line.target ? <span className="text-cyan-300">{line.target}</span> : null}
                {line.details ? <span className="text-neutral-500">{line.details}</span> : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      <label className="flex items-center gap-2 border-t border-neutral-800 bg-neutral-900 px-4 py-2.5">
        <span className="shrink-0 font-bold text-emerald-400">kadik@panel:~$ grep</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="filtrele: e-posta, işlem, sayfa…"
          aria-label="Kayıtlarda ara"
          style={{ backgroundColor: "transparent", color: "var(--color-neutral-100)", border: 0, padding: 0, boxShadow: "none", outline: "none" }}
          className="min-w-0 flex-1 bg-transparent text-neutral-100 caret-emerald-400 placeholder:text-neutral-600 focus:outline-none"
          spellCheck={false}
        />
        <span className="inline-block h-4 w-2 animate-pulse bg-emerald-400" aria-hidden="true" />
      </label>
    </section>
  );
}
