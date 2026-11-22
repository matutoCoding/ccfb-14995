// 三推风险:从洞杯向外反推,评估各区域一推上果岭后留下的距离
import type { Cup, GreenConditions, SurfaceSampler, Vec2 } from "@/types"
import { simulatePutt } from "@/physics/simulate"
import { effectiveMu, G } from "@/physics/stimp"

export interface RiskCell {
  x: number
  y: number
  miss: number // 标准力度直推后的剩余距离 m
}

// 从洞杯向外辐射扫描 + 区域内直推评估
// 对每个采样点:以"到洞+0.45m"的力度直推,剩余距离即风险值
export const computeRiskField = (
  cup: Cup,
  sampler: SurfaceSampler,
  cond: GreenConditions,
  captureSpeed: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  stepM = 1,
  maxRadiusM = 15,
  onProgress?: (done: number, total: number) => void,
): RiskCell[] => {
  const cells: Array<{ x: number; y: number }> = []
  for (let x = bounds.minX; x <= bounds.maxX; x += stepM) {
    for (let y = bounds.minY; y <= bounds.maxY; y += stepM) {
      const d = Math.hypot(x - cup.pos.x, y - cup.pos.y)
      if (d < 0.5 || d > maxRadiusM) continue
      if (sampler(x, y).onGreen) cells.push({ x, y })
    }
  }
  const out: RiskCell[] = []
  const mu = effectiveMu(cond, 0)
  cells.forEach((cell, i) => {
    const dist = Math.hypot(cup.pos.x - cell.x, cup.pos.y - cell.y)
    const angle = Math.atan2(cup.pos.y - cell.y, cup.pos.x - cell.x)
    // 平地解析初速,直推不修正线路(评估的是"随手一推"的风险)
    const speed = Math.sqrt(2 * mu * G * (dist + 0.45))
    const r = simulatePutt({
      start: cell,
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      sampler,
      conditions: cond,
      cup,
      captureSpeed,
      traceEvery: 1 << 30,
    })
    const miss =
      r.outcome === "holed"
        ? 0
        : Math.hypot(r.end.x - cup.pos.x, r.end.y - cup.pos.y)
    out.push({ x: cell.x, y: cell.y, miss })
    if (onProgress && i % 50 === 0) onProgress(i, cells.length)
  })
  return out
}

// 风险分级:>1m 大概率三推区,0.5~1m 警戒
export const riskLevel = (miss: number): 0 | 1 | 2 => (miss > 1 ? 2 : miss > 0.5 ? 1 : 0)
