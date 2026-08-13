"use client"

import { useEffect, useState } from "react"
import { Bug, ChevronDown, Clipboard, X } from "lucide-react"
import {
  readAppDiagnostics,
  subscribeAppDiagnostics,
} from "@/lib/debug/app-diagnostics"

export function ViewportDebugPanel({ onDisable }: { onDisable: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [copyStatus, setCopyStatus] = useState("")
  const [entries, setEntries] = useState(readAppDiagnostics)

  useEffect(() => subscribeAppDiagnostics(() => {
    setEntries(readAppDiagnostics())
  }), [])

  if (!expanded) {
    return (
      <button
        type="button"
        aria-label="Open viewport diagnostics"
        onClick={() => setExpanded(true)}
        className="viewport-debug-trigger"
      >
        <Bug className="h-4 w-4" />
        Viewport debug
      </button>
    )
  }

  const latestEntry = entries.at(-1)
  const copiedJson = JSON.stringify(entries, null, 2)

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(copiedJson)
      setCopyStatus("Copied diagnostics")
    } catch {
      setCopyStatus("Copy failed")
    }
  }

  return (
    <aside className="viewport-debug-panel" aria-label="Viewport diagnostics">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em]">Viewport diagnostics</p>
          <p className="mt-1 text-[11px] text-white/60">{entries.length} events retained</p>
        </div>
        <button
          type="button"
          aria-label="Collapse viewport diagnostics"
          onClick={() => setExpanded(false)}
          className="viewport-debug-icon-button"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-black/45 p-3 text-[10px] leading-relaxed text-emerald-200">
        {latestEntry ? JSON.stringify(latestEntry, null, 2) : "Waiting for an event..."}
      </pre>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void copyDiagnostics()} className="viewport-debug-action">
          <Clipboard className="h-4 w-4" />
          Copy JSON
        </button>
        <button type="button" onClick={onDisable} className="viewport-debug-action">
          <X className="h-4 w-4" />
          Disable
        </button>
      </div>
      <p className="mt-2 min-h-4 text-[10px] text-white/65" aria-live="polite">{copyStatus}</p>
    </aside>
  )
}
