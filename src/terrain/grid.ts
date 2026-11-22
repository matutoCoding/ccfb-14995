// 高度场网格:双线性插值 + 中心差分梯度
import type { Green, SurfaceSample, SurfaceSampler, Vec2 } from "@/types"

export interface GridData {
  cols: number
  rows: number
  cell: number
  originX: number
  originY: number
  heights: number[]
}

// 点在多边形内(射线法)
export const pointInPolygon = (x: number, y: number, poly: Vec2[]): boolean => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// 点到多边形边界的最短距离(用于洞杯距边缘步数)
export const distToPolygonEdge = (x: number, y: number, poly: Vec2[]): number => {
  let best = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j].x
    const ay = poly[j].y
    const bx = poly[i].x
    const by = poly[i].y
    const abx = bx - ax
    const aby = by - ay
    const len2 = abx * abx + aby * aby
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * abx + (y - ay) * aby) / len2))
    best = Math.min(best, Math.hypot(x - (ax + abx * t), y - (ay + aby * t)))
  }
  return best
}

export const heightAt = (g: GridData, x: number, y: number): number => {
  const fx = (x - g.originX) / g.cell
  const fy = (y - g.originY) / g.cell
  const x0 = Math.max(0, Math.min(g.cols - 2, Math.floor(fx)))
  const y0 = Math.max(0, Math.min(g.rows - 2, Math.floor(fy)))
  const tx = Math.max(0, Math.min(1, fx - x0))
  const ty = Math.max(0, Math.min(1, fy - y0))
  const h00 = g.heights[y0 * g.cols + x0]
  const h10 = g.heights[y0 * g.cols + x0 + 1]
  const h01 = g.heights[(y0 + 1) * g.cols + x0]
  const h11 = g.heights[(y0 + 1) * g.cols + x0 + 1]
  return (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty
}

// 中心差分梯度
export const gradientAt = (g: GridData, x: number, y: number): { gx: number; gy: number } => {
  const e = g.cell
  return {
    gx: (heightAt(g, x + e, y) - heightAt(g, x - e, y)) / (2 * e),
    gy: (heightAt(g, x, y + e) - heightAt(g, x, y - e)) / (2 * e),
  }
}

// 由果岭档案构造物理采样器
export const makeSampler = (green: Green): SurfaceSampler => {
  const g = green.grid
  return (x: number, y: number): SurfaceSample => {
    const onGreen = pointInPolygon(x, y, green.outline)
    if (!onGreen) return { h: 0, gx: 0, gy: 0, onGreen: false }
    const { gx, gy } = gradientAt(g, x, y)
    return { h: heightAt(g, x, y), gx, gy, onGreen: true }
  }
}

// 网格范围内逐格坡度(用于可视化与合法性检查)
export const slopeAtCell = (g: GridData, col: number, row: number): number => {
  const x = g.originX + col * g.cell
  const y = g.originY + row * g.cell
  const { gx, gy } = gradientAt(g, x, y)
  return Math.hypot(gx, gy)
}
