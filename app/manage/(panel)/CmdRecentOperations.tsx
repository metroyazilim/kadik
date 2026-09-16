"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal, Maximize2, Minimize2, ArrowUpCircle } from "lucide-react";

type AuditEntry = Readonly<{
  id: string;
  action: string;
  entity: string;
  time: string;
}>;

const ACTION_LABEL: Record<string, string> = {
  login: "AUTH.LOGIN",
  logout: "AUTH.LOGOUT",
  create: "CONTENT.CREATE",
  update: "CONTENT.UPDATE",
  publish: "CONTENT.PUBLISH",
  archive: "CONTENT.ARCHIVE",
  delete: "CONTENT.DELETE",
  "content.publish": "CONTENT.PUBLISH",
  "content.draft.save": "CONTENT.DRAFT_SAVE",
  "content.archive": "CONTENT.ARCHIVE",
  "content.unarchive": "CONTENT.UNARCHIVE",
  "content.delete": "CONTENT.DELETE",
  "content.hardDelete": "CONTENT.HARD_DELETE",
  "home.layout.draft.save": "HOME.LAYOUT_SAVE",
  "home.layout.publish": "HOME.LAYOUT_PUBLISH",
};

export function CmdRecentOperations({ entries }: { entries: readonly AuditEntry[] }) {
  const [fullscreen, setFullscreen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Reverse list so newest entries naturally append and roll upwards like a terminal buffer
  const terminalLines = [...entries].reverse();

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <section aria-labelledby="cmd-operations-title" className="mt-8 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-emerald-400" />
          <h2 id="cmd-operations-title" className="text-sm font-bold tracking-tight text-brand-text">
            Sistem Konsolu (Son İşlemler)
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-emerald-500">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
          LIVE STREAM
        </span>
      </div>

      <div
        className={`overflow-hidden rounded-md border border-neutral-800 bg-[#080c14] text-neutral-200 shadow-2xl transition-all ${
          fullscreen ? "fixed inset-4 z-50 flex flex-col rounded-lg border-neutral-700 bg-[#080c14]" : ""
        }`}
      >
        {/* Terminal Header / Titlebar */}
        <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0d131f] px-3.5 py-2.5 select-none">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-[#ef4444] border border-red-700 inline-block" />
            <span className="size-3 rounded-full bg-[#eab308] border border-yellow-700 inline-block" />
            <span className="size-3 rounded-full bg-[#22c55e] border border-green-700 inline-block" />
            <span className="ml-2 font-mono text-xs font-semibold text-neutral-300">
              kadik@local: ~/logs/audit.log
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-neutral-400">
              <ArrowUpCircle className="size-3.5 text-emerald-400" />
              akış yukarı yönlü
            </span>
            <button
              type="button"
              onClick={() => setFullscreen((current) => !current)}
              className="text-neutral-400 hover:text-neutral-100 transition-colors p-1"
              aria-label={fullscreen ? "Pencereyi küçült" : "Tam ekran yap"}
            >
              {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
          </div>
        </div>

        {/* Terminal Screen / Output Body */}
        <div
          ref={bodyRef}
          className={`space-y-2 p-4 font-mono text-xs overflow-y-auto ${
            fullscreen ? "flex-1 min-h-0" : "max-h-[340px]"
          }`}
          style={{ scrollBehavior: "smooth" }}
        >
          <div className="text-neutral-400 text-[11px] pb-2 border-b border-neutral-800/60 leading-relaxed">
            <div>Metro Engine v2.4 Audit Monitor initialized.</div>
            <div>Listening to database transaction logs & mutation events...</div>
          </div>

          {terminalLines.length === 0 ? (
            <p className="py-6 text-center text-neutral-400">Henüz kaydedilmiş işlem kaydı bulunmuyor.</p>
          ) : (
            <div className="divide-y divide-neutral-900/60">
              {terminalLines.map((entry, index) => {
                const isLatest = index === terminalLines.length - 1;
                const formattedAction = ACTION_LABEL[entry.action] ?? entry.action.toUpperCase();

                return (
                  <div
                    key={entry.id}
                    className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-1.5 px-2 rounded hover:bg-neutral-800/40 transition-colors ${
                      isLatest ? "bg-emerald-950/20 border-l-2 border-emerald-400 pl-2.5" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-neutral-400 font-mono text-[11px]">
                        [{entry.time}]
                      </span>
                      <span className="font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded text-[10px] tracking-wide">
                        {formattedAction}
                      </span>
                      <span className="text-neutral-100 font-medium">
                        Target: <span className="text-cyan-300 font-semibold">{entry.entity}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-right text-[11px]">
                      <span className="text-neutral-400 font-mono">id:{entry.id.slice(-6)}</span>
                      {isLatest && (
                        <span className="inline-block size-1.5 rounded-full bg-emerald-400 animate-ping" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CMD Command prompt line */}
          <div className="pt-3 flex items-center gap-2 text-neutral-300 border-t border-neutral-800/80">
            <span className="font-bold text-emerald-400">kadik@local:~$</span>
            <span className="text-neutral-200 font-mono">tail -f /var/log/audit.log</span>
            <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  );
}
