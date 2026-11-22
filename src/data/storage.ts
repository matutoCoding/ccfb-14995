// localStorage 持久化,键命名 greenreader:模块:业务
import type { AppSettings, Green, PinPosition } from "@/types"

const PREFIX = "greenreader"

const read = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(`${PREFIX}:${key}`)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

const write = (key: string, value: unknown): void => {
  localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value))
}

export const DEFAULT_SETTINGS: AppSettings = {
  paceLengthM: 0.9,
  slopeLimitPct: 3,
  edgeMinPaces: 4,
  captureSpeed: 1.6,
  pinReuseWarnDays: 7,
  pinReuseBlockDays: 4,
  contourIntervalM: 0.1,
}

export const storage = {
  loadGreens: (): Green[] => read<Green[]>("greens") ?? [],
  saveGreens: (greens: Green[]) => write("greens", greens),
  loadPins: (): PinPosition[] => read<PinPosition[]>("pins:history") ?? [],
  savePins: (pins: PinPosition[]) => write("pins:history", pins),
  loadSettings: (): AppSettings => ({ ...DEFAULT_SETTINGS, ...(read<Partial<AppSettings>>("settings") ?? {}) }),
  saveSettings: (s: AppSettings) => write("settings", s),
  loadPlan: (): Record<string, PinPosition[]> => read("plans:current") ?? {},
  savePlan: (p: Record<string, PinPosition[]>) => write("plans:current", p),
}
