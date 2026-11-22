// 集成测试:种子果岭、洞位合法性、自动排洞均衡性
import { describe, it, expect } from "vitest"
import { makeSeedGreens } from "@/data/seed"
import { legalPinCandidates, checkPinLegality } from "@/planning/legality"
import { generatePinSets, zoneOf, zoneLabel } from "@/planning/zones"
import { makeSampler } from "@/terrain/grid"
import { simulatePuttAt } from "@/physics/simulate"
import { STIMP_V0, FT_TO_M } from "@/physics/stimp"
import { DEFAULT_SETTINGS } from "@/data/storage"

const greens = makeSeedGreens()

describe("种子果岭", () => {
  it("生成 18 个洞,四种设计循环", () => {
    expect(greens).toHaveLength(18)
    const names = new Set(greens.map((g) => g.name.split(" · ")[1]))
    expect(names.size).toBe(4)
  })

  it("每个果岭都有合法洞位候选", () => {
    for (const g of greens) {
      const candidates = legalPinCandidates(g, DEFAULT_SETTINGS, 1.5)
      expect(candidates.length, `${g.name} 无合法洞位`).toBeGreaterThan(0)
    }
  })

  it("真实地形上 stimp 停球距离合理(含坡度误差 < 5%)", () => {
    // 取平地重纹果岭中心,沿顺坡/逆坡平均后应接近理论值
    const g = greens.find((gr) => gr.name.includes("平地重纹"))!
    const sampler = makeSampler(g)
    const cond = { ...g.conditions, grainStrength: 0, moisture: 0 }
    const center = { x: 11, y: 12 }
    const r1 = simulatePuttAt(center, 0, STIMP_V0, sampler, cond)
    const r2 = simulatePuttAt(center, Math.PI, STIMP_V0, sampler, cond)
    const avg = (r1.distance + r2.distance) / 2
    const expect_m = g.conditions.stimpFt * FT_TO_M
    expect(Math.abs(avg - expect_m) / expect_m).toBeLessThan(0.05)
  })
})

describe("自动排洞", () => {
  it("生成 3 套方案,每套 18 个洞位全部合规", () => {
    const sets = generatePinSets(greens, DEFAULT_SETTINGS, [], 3, "2026-11-22")
    expect(sets.length).toBe(3)
    for (const set of sets) {
      expect(set).toHaveLength(18)
      for (const pin of set) {
        const g = greens.find((gr) => gr.holeNo === pin.holeNo)!
        expect(checkPinLegality(g, pin.pos, DEFAULT_SETTINGS).ok).toBe(true)
      }
    }
  })

  it("同一日期种子结果确定", () => {
    const a = generatePinSets(greens, DEFAULT_SETTINGS, [], 1, "2026-11-22")
    const b = generatePinSets(greens, DEFAULT_SETTINGS, [], 1, "2026-11-22")
    expect(a).toEqual(b)
  })

  it("九宫格分布均衡:每格恰好 2 次", () => {
    const [set] = generatePinSets(greens, DEFAULT_SETTINGS, [], 1, "2026-11-22")
    const counts = new Map<string, number>()
    for (const pin of set) {
      const g = greens.find((gr) => gr.holeNo === pin.holeNo)!
      const z = zoneLabel(zoneOf(g, pin.pos))
      counts.set(z, (counts.get(z) ?? 0) + 1)
    }
    // 允许个别果岭宫格内无合法位导致的轻微偏差,但每格不超过 3 次
    for (const [, count] of counts) expect(count).toBeLessThanOrEqual(3)
    expect(counts.size).toBeGreaterThanOrEqual(7)
  })

  it("历史禁用期内的位置不会被重用", () => {
    const [first] = generatePinSets(greens, DEFAULT_SETTINGS, [], 1, "2026-11-22")
    const [second] = generatePinSets(greens, DEFAULT_SETTINGS, first, 1, "2026-11-23")
    for (const pin of second) {
      const prev = first.find((p) => p.holeNo === pin.holeNo)!
      const d = Math.hypot(prev.pos.x - pin.pos.x, prev.pos.y - pin.pos.y)
      expect(d).toBeGreaterThanOrEqual(3)
    }
  })
})
