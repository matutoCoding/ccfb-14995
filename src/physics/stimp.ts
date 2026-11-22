// 果岭速度(stimp)与摩擦模型
// 定义:球以标准释放速度 v0 在平地滚动的停止距离即 stimp 读数(英尺)
// 由 v0^2 = 2 * mu * g * d 反解 mu,保证平地停球距离与定义严格一致
import type { GreenConditions } from "@/types"

export const G = 9.81 // m/s^2
export const STIMP_V0 = 1.8288 // 标准释放速度 6 ft/s
export const FT_TO_M = 0.3048
export const CUP_RADIUS = 0.054 // 洞杯半径 m(直径 4.25 英寸)

// stimp 读数(英尺) -> 滚动摩擦系数
export const muFromStimp = (stimpFt: number): number =>
  (STIMP_V0 * STIMP_V0) / (2 * G * stimpFt * FT_TO_M)

// 反算:给定摩擦系数,平地上 v0 初速的停球距离(m)
export const stopDistanceFlat = (mu: number, v0: number): number =>
  (v0 * v0) / (2 * mu * G)

// 露水/干燥对摩擦的修正:湿度 0..1,湿慢干快
export const moistureFactor = (moisture: number): number => 1 + 0.2 * moisture

// 草纹各向异性:顺纹快、逆纹慢
// 返回给定运动方向(弧度)下的有效摩擦系数
export const effectiveMu = (
  cond: GreenConditions,
  velocityAngle: number,
): number => {
  const base = muFromStimp(cond.stimpFt) * moistureFactor(cond.moisture)
  if (cond.grainStrength <= 0) return base
  const grainRad = (cond.grainDirDeg * Math.PI) / 180
  // cos>0 顺纹(摩擦减小),cos<0 逆纹(摩擦增大)
  const align = Math.cos(velocityAngle - grainRad)
  return base * (1 - 0.25 * cond.grainStrength * align)
}

// 由目标停球距离反推平地所需初速(用于力度换算)
export const speedForDistance = (cond: GreenConditions, distM: number, angle = 0): number =>
  Math.sqrt(2 * effectiveMu(cond, angle) * G * distM)
