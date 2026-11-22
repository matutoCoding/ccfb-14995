// 全局响应式状态:果岭、洞位历史、设置
import { reactive, computed } from "vue"
import type { AppSettings, Green, PinPosition } from "@/types"
import { storage } from "./storage"
import { makeSeedGreens } from "./seed"

interface State {
  greens: Green[]
  pins: PinPosition[]
  settings: AppSettings
  plan: Record<string, PinPosition[]> // 方案名 -> 18 洞位
  ready: boolean
}

export const state: State = reactive({
  greens: [],
  pins: [],
  settings: storage.loadSettings(),
  plan: {},
  ready: false,
})

export const initStore = (): void => {
  let greens = storage.loadGreens()
  if (greens.length === 0) {
    greens = makeSeedGreens()
    storage.saveGreens(greens)
  }
  state.greens = greens
  state.pins = storage.loadPins()
  state.plan = storage.loadPlan()
  state.ready = true
}

export const greenByHole = computed(() => {
  const map = new Map<number, Green>()
  for (const g of state.greens) map.set(g.holeNo, g)
  return map
})

export const saveGreens = (): void => storage.saveGreens(state.greens)

export const updateGreen = (green: Green): void => {
  const i = state.greens.findIndex((g) => g.id === green.id)
  if (i >= 0) state.greens[i] = green
  else state.greens.push(green)
  saveGreens()
}

export const addPins = (pins: PinPosition[]): void => {
  state.pins.push(...pins)
  storage.savePins(state.pins)
}

export const saveSettings = (): void => storage.saveSettings(state.settings)

export const savePlan = (): void => storage.savePlan(state.plan)

// 某洞位附近在历史中被使用的次数与最近日期(草皮磨损提醒)
export const pinUsageNear = (holeNo: number, pos: { x: number; y: number }, radiusM = 1.5) => {
  const hits = state.pins.filter(
    (p) => p.holeNo === holeNo && Math.hypot(p.pos.x - pos.x, p.pos.y - pos.y) <= radiusM,
  )
  const latest = hits.reduce((acc, p) => (p.date > acc ? p.date : acc), "")
  return { count: hits.length, latest }
}
