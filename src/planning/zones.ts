// 自动排洞:18 洞位在 前/中/后 x 左/中/右 九宫格内均衡分布
import type { AppSettings, Green, PinPosition, Vec2 } from "@/types"
import { legalPinCandidates } from "./legality"
import { mulberry32 } from "@/data/rng"

export type DepthZone = "front" | "mid" | "back"
export type SideZone = "left" | "center" | "right"

export interface Zone {
  depth: DepthZone
  side: SideZone
}

// 以进攻方向为基准,把点投影到 深度/横向 坐标,返回所在宫格
export const zoneOf = (green: Green, pos: Vec2): Zone => {
  const rad = (green.approachDirDeg * Math.PI) / 180
  // 深度轴 = 进攻方向,横轴 = 垂直于进攻方向
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const cx = green.outline.reduce((s, p) => s + p.x, 0) / green.outline.length
  const cy = green.outline.reduce((s, p) => s + p.y, 0) / green.outline.length
  const depthProj = (p: Vec2) => (p.x - cx) * dx + (p.y - cy) * dy
  const sideProj = (p: Vec2) => -(p.x - cx) * dy + (p.y - cy) * dx
  const dVals = green.outline.map(depthProj)
  const sVals = green.outline.map(sideProj)
  const dMin = Math.min(...dVals)
  const dMax = Math.max(...dVals)
  const sMin = Math.min(...sVals)
  const sMax = Math.max(...sVals)
  const dT = (depthProj(pos) - dMin) / (dMax - dMin || 1)
  const sT = (sideProj(pos) - sMin) / (sMax - sMin || 1)
  const depth: DepthZone = dT < 1 / 3 ? "front" : dT < 2 / 3 ? "mid" : "back"
  const side: SideZone = sT < 1 / 3 ? "left" : sT < 2 / 3 ? "center" : "right"
  return { depth, side }
}

const ZONE_NAMES: Record<DepthZone, string> = { front: "前", mid: "中", back: "后" }
const SIDE_NAMES: Record<SideZone, string> = { left: "左", center: "中", right: "右" }
export const zoneLabel = (z: Zone): string => `${ZONE_NAMES[z.depth]}${SIDE_NAMES[z.side]}`

// 九个宫格,18 洞每格恰好 2 次
const ALL_ZONES: Zone[] = (["front", "mid", "back"] as DepthZone[]).flatMap((depth) =>
  (["left", "center", "right"] as SideZone[]).map((side) => ({ depth, side })),
)

const zoneKey = (z: Zone) => `${z.depth}_${z.side}`

// 生成一套 18 洞洞位方案;seed 固定则结果固定
export const generatePinSet = (
  greens: Green[],
  settings: AppSettings,
  history: PinPosition[],
  seed: number,
  date: string,
): PinPosition[] | null => {
  const rand = mulberry32(seed)
  // 宫格分配打乱:每个宫格出现两次
  const deck = [...ALL_ZONES, ...ALL_ZONES]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }

  const result: PinPosition[] = []
  const assigned = new Map<string, number>() // 已分配宫格计数,兜底时保持均衡
  for (let idx = 0; idx < greens.length && idx < 18; idx++) {
    const green = greens[idx]
    const targetZone = deck[idx]
    const candidates = legalPinCandidates(green, settings, 0.8)
    if (candidates.length === 0) return null

    // 近期使用过的位置(禁用期内)排除
    const recent = history.filter((p) => {
      if (p.holeNo !== green.holeNo) return false
      const days = (Date.parse(date) - Date.parse(p.date)) / 86400000
      return days <= settings.pinReuseBlockDays
    })
    const usable = candidates.filter(
      (c) => !recent.some((p) => Math.hypot(p.pos.x - c.x, p.pos.y - c.y) < 3),
    )
    // 全部候选都在禁用期内时,退而求其次选离历史洞位最远的
    const pool =
      usable.length > 0
        ? usable
        : candidates.filter((c) => {
            const d = Math.min(...recent.map((p) => Math.hypot(p.pos.x - c.x, p.pos.y - c.y)))
            const maxD = Math.max(...candidates.map((cc) => Math.min(...recent.map((p) => Math.hypot(p.pos.x - cc.x, p.pos.y - cc.y)))))
            return d >= maxD - 1e-9
          })

    // 先选目标宫格内的候选;没有则选当前分配最少的宫格,保持整体均衡
    const inZone = pool.filter((c) => zoneKey(zoneOf(green, c)) === zoneKey(targetZone))
    let finalPool = inZone
    if (finalPool.length === 0) {
      let minCount = Infinity
      for (const c of pool) {
        const k = zoneKey(zoneOf(green, c))
        minCount = Math.min(minCount, assigned.get(k) ?? 0)
      }
      finalPool = pool.filter((c) => (assigned.get(zoneKey(zoneOf(green, c))) ?? 0) === minCount)
    }
    const pick = finalPool[Math.floor(rand() * finalPool.length)]
    const pickKey = zoneKey(zoneOf(green, pick))
    assigned.set(pickKey, (assigned.get(pickKey) ?? 0) + 1)
    result.push({
      id: `${date}-h${green.holeNo}-${seed}`,
      holeNo: green.holeNo,
      pos: pick,
      date,
      source: "auto",
    })
  }
  return result
}

// 一次生成多套方案
export const generatePinSets = (
  greens: Green[],
  settings: AppSettings,
  history: PinPosition[],
  count: number,
  date: string,
): PinPosition[][] => {
  const sets: PinPosition[][] = []
  // 种子含日期:同一天结果确定,换天方案不同
  const dateSeed = [...date].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
  for (let i = 0; i < count * 4 && sets.length < count; i++) {
    const s = generatePinSet(greens, settings, history, dateSeed + i * 17, date)
    if (s) sets.push(s)
  }
  return sets
}
