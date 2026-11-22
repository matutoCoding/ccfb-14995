// 读线反推:给定起点与洞杯,求各档力度的瞄准方向与初速
import type { Cup, GreenConditions, PuttResult, SurfaceSampler, Vec2 } from "@/types"
import { simulatePutt } from "@/physics/simulate"
import { effectiveMu, G } from "@/physics/stimp"

export interface ReadLine {
  paceLabel: string
  beyondM: number // 过洞目标距离
  aimAngleDeg: number // 瞄准方向(相对正 x 轴)
  aimPoint: Vec2 // 瞄准点(起点沿瞄准方向 1m 处,用于显示)
  speed: number // 初速 m/s
  result: PuttResult
}

// 固定方向,二分初速使球停在目标距离(平地解析值做初值)
const solveSpeed = (
  start: Vec2,
  angle: number,
  targetDist: number,
  sampler: SurfaceSampler,
  cond: GreenConditions,
  cup: Cup | undefined,
  captureSpeed: number,
): number => {
  const mu = effectiveMu(cond, angle)
  let lo = Math.sqrt(2 * mu * G * targetDist) * 0.5
  let hi = lo * 3
  const distOf = (v: number): number => {
    const r = simulatePutt({
      start,
      velocity: { x: Math.cos(angle) * v, y: Math.sin(angle) * v },
      sampler,
      conditions: cond,
      cup,
      captureSpeed,
      traceEvery: 1 << 30,
    })
    // 进洞按到达洞杯距离计
    return r.outcome === "holed" && cup
      ? Math.hypot(cup.pos.x - start.x, cup.pos.y - start.y)
      : Math.hypot(r.end.x - start.x, r.end.y - start.y)
  }
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2
    if (distOf(mid) < targetDist) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// 单档力度:扫描瞄准角,找能进洞(或最接近)的线
const solveLine = (
  start: Vec2,
  cup: Cup,
  beyondM: number,
  sampler: SurfaceSampler,
  cond: GreenConditions,
  captureSpeed: number,
): ReadLine | null => {
  const toCup = Math.atan2(cup.pos.y - start.y, cup.pos.x - start.x)
  const dist = Math.hypot(cup.pos.x - start.x, cup.pos.y - start.y)
  const targetDist = dist + beyondM

  let best: { angle: number; miss: number; speed: number; result: PuttResult } | null = null
  // 粗扫 +-40 度,再局部细化
  const tryAngle = (deltaDeg: number) => {
    const angle = toCup + (deltaDeg * Math.PI) / 180
    const speed = solveSpeed(start, angle, targetDist, sampler, cond, cup, captureSpeed)
    const result = simulatePutt({
      start,
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      sampler,
      conditions: cond,
      cup,
      captureSpeed,
    })
    const miss = result.outcome === "holed" ? 0 : result.closestToCup
    if (!best || miss < best.miss) best = { angle, miss, speed, result }
  }
  for (let d = -40; d <= 40; d += 2) tryAngle(d)
  if (!best) return null
  const coarse = (best as { angle: number }).angle
  for (let d = -2; d <= 2; d += 0.25) {
    tryAngle(((coarse - toCup) * 180) / Math.PI + d)
  }
  const b = best as unknown as { angle: number; miss: number; speed: number; result: PuttResult }
  if (b.miss > cup.radius * 2) return null // 找不到能进的线
  return {
    paceLabel: "",
    beyondM,
    aimAngleDeg: (b.angle * 180) / Math.PI,
    aimPoint: { x: start.x + Math.cos(b.angle), y: start.y + Math.sin(b.angle) },
    speed: b.speed,
    result: b.result,
  }
}

// 三档力度:贴洞(过洞 0.2m)、标准(0.45m)、强攻(1m)
export const solveReadLines = (
  start: Vec2,
  cup: Cup,
  sampler: SurfaceSampler,
  cond: GreenConditions,
  captureSpeed: number,
): ReadLine[] => {
  const paces: Array<[string, number]> = [
    ["贴洞", 0.2],
    ["标准", 0.45],
    ["强攻", 1.0],
  ]
  const lines: ReadLine[] = []
  for (const [label, beyond] of paces) {
    const line = solveLine(start, cup, beyond, sampler, cond, captureSpeed)
    if (line) lines.push({ ...line, paceLabel: label })
  }
  return lines
}
