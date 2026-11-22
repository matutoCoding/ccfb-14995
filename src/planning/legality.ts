// 洞位合法性:洞杯周围 1m 内坡度不得超标,距边缘不得过近
import type { AppSettings, Green, Vec2 } from "@/types"
import { gradientAt, pointInPolygon, distToPolygonEdge } from "@/terrain/grid"

export interface LegalityResult {
  ok: boolean
  maxSlopePct: number // 1m 圆内最大坡度 %
  avgSlopePct: number
  edgeDistM: number // 距果岭边缘
  reasons: string[]
}

export const checkPinLegality = (green: Green, pos: Vec2, settings: AppSettings): LegalityResult => {
  const reasons: string[] = []
  if (!pointInPolygon(pos.x, pos.y, green.outline)) {
    return { ok: false, maxSlopePct: 0, avgSlopePct: 0, edgeDistM: 0, reasons: ["在果岭外"] }
  }
  // 1m 圆内采样(0.25m 网格)
  let maxSlope = 0
  let sum = 0
  let n = 0
  for (let dx = -1; dx <= 1.001; dx += 0.25) {
    for (let dy = -1; dy <= 1.001; dy += 0.25) {
      if (dx * dx + dy * dy > 1) continue
      const { gx, gy } = gradientAt(green.grid, pos.x + dx, pos.y + dy)
      const s = Math.hypot(gx, gy)
      maxSlope = Math.max(maxSlope, s)
      sum += s
      n++
    }
  }
  const maxSlopePct = maxSlope * 100
  const avgSlopePct = (sum / n) * 100
  const edgeDistM = distToPolygonEdge(pos.x, pos.y, green.outline)
  const edgePaces = edgeDistM / settings.paceLengthM

  if (maxSlopePct > settings.slopeLimitPct) {
    reasons.push(`1m 内最大坡度 ${maxSlopePct.toFixed(1)}% 超过 ${settings.slopeLimitPct}%`)
  }
  if (edgePaces < settings.edgeMinPaces) {
    reasons.push(`距边缘 ${edgePaces.toFixed(1)} 步,不足 ${settings.edgeMinPaces} 步`)
  }
  return { ok: reasons.length === 0, maxSlopePct, avgSlopePct, edgeDistM, reasons }
}

// 扫描全果岭,返回合法洞位候选(供自动排洞)
export const legalPinCandidates = (green: Green, settings: AppSettings, stepM = 1): Vec2[] => {
  const out: Vec2[] = []
  const xs = green.outline.map((p) => p.x)
  const ys = green.outline.map((p) => p.y)
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += stepM) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += stepM) {
      if (checkPinLegality(green, { x, y }, settings).ok) out.push({ x, y })
    }
  }
  return out
}
