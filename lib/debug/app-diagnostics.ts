export type DiagnosticValue = string | number | boolean | null

export interface AppDiagnosticEntry {
  event: string
  timestamp: string
  data: Record<string, DiagnosticValue>
}

export type DiagnosticPersistence = "enable" | "disable" | "unchanged"

export interface DiagnosticPreference {
  enabled: boolean
  persistence: DiagnosticPersistence
}

export interface DiagnosticBuffer {
  push(entry: AppDiagnosticEntry): void
  read(): AppDiagnosticEntry[]
  clear(): void
}

const DIAGNOSTIC_STORAGE_KEY = "huddle.viewportDebug"
const diagnosticBuffer = createDiagnosticBuffer(50)
const diagnosticListeners = new Set<() => void>()
let diagnosticsEnabled = false

export function resolveDiagnosticPreference(
  search: string,
  storedEnabled: boolean,
): DiagnosticPreference {
  const value = new URLSearchParams(search).get("viewportDebug")
  if (value === "1") {
    return { enabled: true, persistence: "enable" }
  }
  if (value === "0") {
    return { enabled: false, persistence: "disable" }
  }
  return { enabled: storedEnabled, persistence: "unchanged" }
}

export function createDiagnosticBuffer(limit: number): DiagnosticBuffer {
  const entries: AppDiagnosticEntry[] = []

  return {
    push(entry) {
      entries.push(entry)
      if (entries.length > limit) {
        entries.splice(0, entries.length - limit)
      }
    },
    read() {
      return [...entries]
    },
    clear() {
      entries.length = 0
    },
  }
}

function notifyDiagnosticListeners(): void {
  for (const listener of diagnosticListeners) {
    listener()
  }
}

function readStoredPreference(): boolean {
  try {
    return window.localStorage.getItem(DIAGNOSTIC_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function persistPreference(enabled: boolean): void {
  try {
    if (enabled) {
      window.localStorage.setItem(DIAGNOSTIC_STORAGE_KEY, "1")
    } else {
      window.localStorage.removeItem(DIAGNOSTIC_STORAGE_KEY)
    }
  } catch {
    // Diagnostics remain usable for this page when storage is unavailable.
  }
}

export function initializeAppDiagnostics(): boolean {
  if (typeof window === "undefined") return false

  const preference = resolveDiagnosticPreference(
    window.location.search,
    readStoredPreference(),
  )
  diagnosticsEnabled = preference.enabled
  if (preference.persistence === "enable") {
    persistPreference(true)
  } else if (preference.persistence === "disable") {
    persistPreference(false)
  }
  if (!diagnosticsEnabled) {
    diagnosticBuffer.clear()
  }
  notifyDiagnosticListeners()
  return diagnosticsEnabled
}

export function disableAppDiagnostics(): void {
  diagnosticsEnabled = false
  persistPreference(false)
  diagnosticBuffer.clear()

  const url = new URL(window.location.href)
  url.searchParams.delete("viewportDebug")
  window.history.replaceState(window.history.state, "", url)
  notifyDiagnosticListeners()
}

export function readAppDiagnostics(): AppDiagnosticEntry[] {
  return diagnosticBuffer.read()
}

export function subscribeAppDiagnostics(listener: () => void): () => void {
  diagnosticListeners.add(listener)
  return () => diagnosticListeners.delete(listener)
}

function rectValue(element: Element | null, edge: "top" | "bottom"): number | null {
  return element ? Math.round(element.getBoundingClientRect()[edge] * 100) / 100 : null
}

export function recordAppDiagnostic(
  event: string,
  extra: Record<string, DiagnosticValue> = {},
): void {
  if (!diagnosticsEnabled || typeof window === "undefined") return

  const root = document.documentElement
  const viewport = window.visualViewport
  const main = document.querySelector<HTMLElement>(".authenticated-main")
  const frame = document.querySelector(".phone-frame-height")
  const header = document.querySelector(".authenticated-main header")
  const navigation = document.querySelector("nav")
  const entry: AppDiagnosticEntry = {
    event,
    timestamp: new Date().toISOString(),
    data: {
      timeOrigin: performance.timeOrigin,
      visible: document.visibilityState === "visible",
      online: navigator.onLine,
      standalone: window.matchMedia("(display-mode: standalone)").matches,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      rootClientWidth: root.clientWidth,
      rootClientHeight: root.clientHeight,
      visualWidth: viewport?.width ?? null,
      visualHeight: viewport?.height ?? null,
      visualOffsetTop: viewport?.offsetTop ?? null,
      visualOffsetLeft: viewport?.offsetLeft ?? null,
      visualScale: viewport?.scale ?? null,
      windowScrollY: window.scrollY,
      mainScrollTop: main?.scrollTop ?? null,
      mainClientHeight: main?.clientHeight ?? null,
      mainScrollHeight: main?.scrollHeight ?? null,
      synchronizedHeight: root.style.getPropertyValue("--app-viewport-height"),
      synchronizedTop: root.style.getPropertyValue("--app-viewport-top"),
      frameTop: rectValue(frame, "top"),
      frameBottom: rectValue(frame, "bottom"),
      headerTop: rectValue(header, "top"),
      headerBottom: rectValue(header, "bottom"),
      navigationTop: rectValue(navigation, "top"),
      navigationBottom: rectValue(navigation, "bottom"),
      ...extra,
    },
  }

  diagnosticBuffer.push(entry)
  console.info("[Huddle diagnostics]", entry)
  notifyDiagnosticListeners()
}
