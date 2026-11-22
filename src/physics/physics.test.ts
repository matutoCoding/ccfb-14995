// 物理引擎验证:stimp 定义一致性、确定性、坡度行为、草纹、洞杯捕获
import { describe, it, expect } from "vitest"
import type { GreenConditions, SurfaceSampler } from "@/types"
import { G, STIMP_V0, FT_TO_M, muFromStimp, effectiveMu, CUP_RADIUS } from "@/physics/stimp"
import { simulatePutt, simulatePuttAt, DT } from "@/physics/simulate"

// 平地采样器
const flatSampler: SurfaceSampler = () => ({ h: 0, gx: 0, gy: 0, onGreen: true })

// 均匀斜坡采样器(沿 x 方向坡度)
const slopeSampler = (gx: number): SurfaceSampler => () => ({ h: 0, gx, gy: 0, onGreen: true })

const cond = (stimpFt: number, extra: Partial<GreenConditions> = {}): GreenConditions => ({
  stimpFt,
  moisture: 0,
  grainStrength: 0,
  grainDirDeg: 0,
  ...extra,
})

describe("stimp 定义一致性", () => {
  it.each([8, 10, 12.5])("平地 stimp=%fft 停球距离误差 < 0.5%%", (stimp) => {
    const r = simulatePutt({
      start: { x: 0, y: 0 },
      velocity: { x: STIMP_V0, y: 0 },
      sampler: flatSampler,
      conditions: cond(stimp),
    })
    const expect_m = stimp * FT_TO_M
    expect(r.outcome).toBe("stopped")
    expect(Math.abs(r.distance - expect_m) / expect_m).toBeLessThan(0.005)
  })

  it("湿度增大滚动变短,干燥变长", () => {
    const dry = simulatePutt({ start: { x: 0, y: 0 }, velocity: { x: 2, y: 0 }, sampler: flatSampler, conditions: cond(10, { moisture: 0 }) })
    const dew = simulatePutt({ start: { x: 0, y: 0 }, velocity: { x: 2, y: 0 }, sampler: flatSampler, conditions: cond(10, { moisture: 1 }) })
    expect(dew.distance).toBeLessThan(dry.distance)
  })
})

describe("确定性", () => {
  it("同起点同力度两次模拟轨迹逐点一致", () => {
    const run = () =>
      simulatePuttAt({ x: 1, y: 2 }, 0.7, 3.2, slopeSampler(0.02), cond(10.5, { grainStrength: 0.6, grainDirDeg: 45 }))
    const a = run()
    const b = run()
    expect(a.points).toEqual(b.points)
    expect(a.end).toEqual(b.end)
    expect(a.outcome).toBe(b.outcome)
  })
})

describe("坡度行为", () => {
  it("上坡停球距离变短,下坡变长", () => {
    const up = simulatePuttAt({ x: 0, y: 0 }, 0, 3, slopeSampler(0.03), cond(10))
    const down = simulatePuttAt({ x: 0, y: 0 }, 0, 3, slopeSampler(-0.03), cond(10))
    const flat = simulatePuttAt({ x: 0, y: 0 }, 0, 3, flatSampler, cond(10))
    expect(up.distance).toBeLessThan(flat.distance)
    expect(down.distance).toBeGreaterThan(flat.distance)
  })

  it("陡坡上慢速球停不住会回滚", () => {
    // 坡度 8% 远超摩擦系数(stimp 10 约 5.5%),低速上坡应停不下并回滚
    const r = simulatePuttAt({ x: 0, y: 0 }, 0, 1.0, slopeSampler(0.08), cond(10))
    expect(r.end.x).toBeLessThan(0) // 回滚到起点后方
  })

  it("缓坡上球能停住", () => {
    const r = simulatePuttAt({ x: 0, y: 0 }, 0, 1.0, slopeSampler(0.02), cond(10))
    expect(r.outcome).toBe("stopped")
    expect(r.end.x).toBeGreaterThan(0)
  })
})

describe("草纹", () => {
  it("顺纹更远,逆纹更近", () => {
    const c = cond(10, { grainStrength: 0.8, grainDirDeg: 0 })
    const withGrain = simulatePuttAt({ x: 0, y: 0 }, 0, 2.5, flatSampler, c)
    const against = simulatePuttAt({ x: 0, y: 0 }, Math.PI, 2.5, flatSampler, c)
    expect(withGrain.distance).toBeGreaterThan(against.distance)
  })
})

describe("洞杯捕获", () => {
  const cup = { pos: { x: 5, y: 0 }, radius: CUP_RADIUS }

  it("正对洞杯速度适中进洞", () => {
    // 选初速使球到洞时仍有 ~0.8m/s
    const r = simulatePuttAt({ x: 0, y: 0 }, 0, 2.6, flatSampler, cond(10), cup)
    expect(r.outcome).toBe("holed")
    expect(r.end).toEqual(cup.pos)
  })

  it("速度过快擦边弹出", () => {
    const r = simulatePuttAt({ x: 0, y: 0 }, 0, 6, flatSampler, cond(10), cup)
    expect(r.outcome).toBe("lipout")
    expect(r.end.x).not.toBe(cup.pos.x)
  })

  it("偏出杯半径不进洞", () => {
    const r = simulatePuttAt({ x: 0, y: 0.2 }, 0, 2.6, flatSampler, cond(10), cup)
    expect(r.outcome).toBe("stopped")
    expect(r.closestToCup).toBeGreaterThan(CUP_RADIUS)
  })
})

describe("摩擦系数标定", () => {
  it("muFromStimp 与解析停球距离一致", () => {
    const mu = muFromStimp(10)
    const d = (STIMP_V0 * STIMP_V0) / (2 * mu * G)
    expect(d).toBeCloseTo(10 * FT_TO_M, 10)
  })

  it("草纹方向影响有效摩擦", () => {
    const c = cond(10, { grainStrength: 1, grainDirDeg: 0 })
    expect(effectiveMu(c, 0)).toBeLessThan(effectiveMu(c, Math.PI))
  })
})
