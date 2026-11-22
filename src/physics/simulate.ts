// 推杆滚动模拟:固定步长半隐式欧拉积分,全程无随机数,结果完全确定
import type { Cup, PuttOutcome, PuttResult, SurfaceSampler, Vec2, GreenConditions } from "@/types"
import { G, CUP_RADIUS, effectiveMu } from "./stimp"

export const DT = 1 / 240 // 积分步长 s
const STOP_SPEED = 0.005 // 低于此速度且坡度无法克服摩擦时静止
const MAX_TIME = 60 // 兜底超时 s

export interface PuttInput {
  start: Vec2
  velocity: Vec2 // 初速度 m/s
  sampler: SurfaceSampler
  conditions: GreenConditions
  cup?: Cup
  captureSpeed?: number // 正心最大进洞速度,默认 1.6
  traceEvery?: number // 每多少步记录一个轨迹点,默认 6
}

// 线段到点的最近距离(用于跨步洞杯检测)
const segPointDist = (a: Vec2, b: Vec2, p: Vec2): number => {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2))
  const cx = a.x + abx * t
  const cy = a.y + aby * t
  return Math.hypot(p.x - cx, p.y - cy)
}

export const simulatePutt = (input: PuttInput): PuttResult => {
  const { start, sampler, conditions } = input
  const cup: Cup | undefined = input.cup
  const captureSpeed = input.captureSpeed ?? 1.6
  const traceEvery = input.traceEvery ?? 6

  let px = start.x
  let py = start.y
  let vx = input.velocity.x
  let vy = input.velocity.y
  let t = 0
  let dist = 0
  let closestToCup = cup ? Math.hypot(px - cup.pos.x, py - cup.pos.y) : Infinity
  let outcome: PuttOutcome = "stopped"
  let lipDeflectCooldown = 0 // 擦边偏转后的冷却,防止在杯口抖动

  const points: Vec2[] = [{ x: px, y: py }]
  let step = 0

  while (t < MAX_TIME) {
    const s = sampler(px, py)
    if (!s.onGreen) {
      outcome = "off-green"
      break
    }
    // 坡度加速度 = -g * 梯度
    const axSlope = -G * s.gx
    const aySlope = -G * s.gy

    // 先加坡度冲量,再沿运动方向施加摩擦冲量(不超过使球停下的量)
    let nvx = vx + axSlope * DT
    let nvy = vy + aySlope * DT
    const speed = Math.hypot(nvx, nvy)
    if (speed > 0) {
      const mu = effectiveMu(conditions, Math.atan2(nvy, nvx))
      const drop = mu * G * DT
      const ns = Math.max(0, speed - drop)
      nvx *= ns / speed
      nvy *= ns / speed
    }

    const ox = px
    const oy = py
    px += nvx * DT
    py += nvy * DT
    dist += Math.hypot(px - ox, py - oy)
    t += DT
    vx = nvx
    vy = nvy
    step++
    lipDeflectCooldown = Math.max(0, lipDeflectCooldown - DT)

    // 洞杯判定:球心进入杯圈时,用运动直线的碰撞参数(到杯心最近距离)判定
    if (cup) {
      const segD = segPointDist({ x: ox, y: oy }, { x: px, y: py }, cup.pos)
      if (segD < closestToCup) closestToCup = segD
      const dx = px - cup.pos.x
      const dy = py - cup.pos.y
      const dCenter = Math.hypot(dx, dy)
      const curSpeed = Math.hypot(vx, vy)
      if (dCenter <= cup.radius && lipDeflectCooldown === 0 && curSpeed > 0) {
        // 碰撞参数:当前运动方向延长线到杯心的垂直距离
        const ux = vx / curSpeed
        const uy = vy / curSpeed
        const along = -(dx * ux + dy * uy) // 杯心在当前位置前方多远
        const impact = along > 0 ? Math.sqrt(Math.max(0, dCenter * dCenter - along * along)) : dCenter
        const offsetRatio = Math.min(1, impact / cup.radius)
        const vCap = captureSpeed * (1 - 0.85 * offsetRatio * offsetRatio)
        if (curSpeed <= vCap) {
          outcome = "holed"
          px = cup.pos.x
          py = cup.pos.y
          points.push({ x: px, y: py })
          break
        }
        // 速度过快:擦边/弹出,绕最近接近点确定性偏转
        outcome = "lipout"
        const cx = px + ux * Math.max(along, 0)
        const cy = py + uy * Math.max(along, 0)
        let nx = cx - cup.pos.x
        let ny = cy - cup.pos.y
        const nl = Math.hypot(nx, ny)
        if (nl < 1e-9) {
          nx = -ux
          ny = -uy
        } else {
          nx /= nl
          ny /= nl
        }
        const radial = vx * nx + vy * ny
        // 径向分量反弹(恢复系数 0.35),切向保留 0.75
        vx = (vx - radial * nx) * 0.75 - radial * 0.35 * nx
        vy = (vy - radial * ny) * 0.75 - radial * 0.35 * ny
        lipDeflectCooldown = 0.25
      }
    }

    if (step % traceEvery === 0) points.push({ x: px, y: py })

    // 静止判定:速度足够低且坡度分量无法克服摩擦
    const spd = Math.hypot(vx, vy)
    if (spd < STOP_SPEED) {
      const slopeAcc = G * Math.hypot(s.gx, s.gy)
      const muStatic = effectiveMu(conditions, Math.atan2(vy, vx)) * G
      if (slopeAcc <= muStatic) {
        // 擦边结局保留,不被静止覆盖
        if (outcome !== "lipout") {
          outcome = cup && Math.hypot(px - cup.pos.x, py - cup.pos.y) <= cup.radius ? "holed" : "stopped"
        }
        break
      }
    }
  }

  if (t >= MAX_TIME) outcome = "timeout"
  points.push({ x: px, y: py })
  return {
    points,
    end: { x: px, y: py },
    outcome,
    time: t,
    distance: dist,
    closestToCup,
  }
}

// 便捷入口:给定起点、方向角(弧度)、初速
export const simulatePuttAt = (
  start: Vec2,
  angleRad: number,
  speed: number,
  sampler: SurfaceSampler,
  conditions: GreenConditions,
  cup?: Cup,
  captureSpeed?: number,
): PuttResult =>
  simulatePutt({
    start,
    velocity: { x: Math.cos(angleRad) * speed, y: Math.sin(angleRad) * speed },
    sampler,
    conditions,
    cup,
    captureSpeed,
  })
