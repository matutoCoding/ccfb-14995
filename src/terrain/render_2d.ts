// 2D 果岭渲染:颜色填充、等高线、坡度箭头、覆盖物
import type { Green, Vec2 } from "@/types"
import { extractContours } from "./contour"
import { gradientAt, heightAt, pointInPolygon } from "./grid"
import type { RiskCell } from "@/planning/risk"

export interface ViewTransform {
  scale: number
  offsetX: number
  offsetY: number
}

// 计算适配画布的变换(y 轴翻转,果岭上方为北)
export const fitTransform = (green: Green, width: number, height: number, padding = 24): ViewTransform => {
  const xs = green.outline.map((p) => p.x)
  const ys = green.outline.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY))
  return {
    scale,
    offsetX: (width - (maxX - minX) * scale) / 2 - minX * scale,
    offsetY: (height - (maxY - minY) * scale) / 2 - minY * scale,
  }
}

export const toCanvas = (t: ViewTransform, p: Vec2, canvasH: number): Vec2 => ({
  x: p.x * t.scale + t.offsetX,
  // y 翻转
  y: canvasH - (p.y * t.scale + t.offsetY),
})

export const toGreen = (t: ViewTransform, p: Vec2, canvasH: number): Vec2 => ({
  x: (p.x - t.offsetX) / t.scale,
  y: (canvasH - p.y - t.offsetY) / t.scale,
})

// 坡度 -> 颜色(绿->黄->红)
export const slopeColor = (pct: number, alpha = 1): string => {
  const t = Math.min(1, pct / 5)
  const hue = 120 * (1 - t)
  return `hsla(${hue}, 65%, 42%, ${alpha})`
}

// 高度 -> 颜色(浅黄->深绿)
export const heightColor = (t: number, alpha = 1): string => {
  const hue = 55 + 75 * t
  const light = 72 - 30 * t
  return `hsla(${hue}, 45%, ${light}%, ${alpha})`
}

export interface RenderOptions {
  colorMode: "none" | "slope" | "height"
  showContours: boolean
  showArrows: boolean
  contourInterval: number
  riskCells?: RiskCell[]
}

export const renderGreenBase = (
  ctx: CanvasRenderingContext2D,
  green: Green,
  t: ViewTransform,
  canvasH: number,
  opts: RenderOptions,
): void => {
  const g = green.grid
  const cellPx = g.cell * t.scale

  // 颜色填充(逐格)
  if (opts.colorMode !== "none") {
    let hMin = Infinity
    let hMax = -Infinity
    if (opts.colorMode === "height") {
      for (const h of g.heights) {
        hMin = Math.min(hMin, h)
        hMax = Math.max(hMax, h)
      }
    }
    for (let r = 0; r < g.rows - 1; r++) {
      for (let c = 0; c < g.cols - 1; c++) {
        const x = g.originX + c * g.cell
        const y = g.originY + r * g.cell
        if (!pointInPolygon(x, y, green.outline)) continue
        const p = toCanvas(t, { x, y: y + g.cell }, canvasH)
        if (opts.colorMode === "slope") {
          const { gx, gy } = gradientAt(g, x, y)
          ctx.fillStyle = slopeColor(Math.hypot(gx, gy) * 100, 0.55)
        } else {
          const h = heightAt(g, x, y)
          ctx.fillStyle = heightColor((h - hMin) / (hMax - hMin || 1), 0.5)
        }
        ctx.fillRect(p.x, p.y, cellPx + 0.5, cellPx + 0.5)
      }
    }
  }

  // 三推风险热区
  if (opts.riskCells) {
    for (const cell of opts.riskCells) {
      const p = toCanvas(t, cell, canvasH)
      const level = cell.miss > 1 ? 2 : cell.miss > 0.5 ? 1 : 0
      if (level === 0) continue
      ctx.fillStyle = level === 2 ? "rgba(220, 38, 38, 0.35)" : "rgba(234, 179, 8, 0.3)"
      const s = t.scale * 1
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
    }
  }

  // 等高线
  if (opts.showContours) {
    const segments = extractContours(g, opts.contourInterval)
    ctx.strokeStyle = "rgba(30, 64, 175, 0.45)"
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const s of segments) {
      const a = toCanvas(t, { x: s.x1, y: s.y1 }, canvasH)
      const b = toCanvas(t, { x: s.x2, y: s.y2 }, canvasH)
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
    }
    ctx.stroke()
  }

  // 坡度箭头(下坡方向)
  if (opts.showArrows) {
    const step = Math.max(1, Math.round(1.5 / g.cell))
    ctx.strokeStyle = "rgba(15, 23, 42, 0.55)"
    ctx.fillStyle = "rgba(15, 23, 42, 0.55)"
    ctx.lineWidth = 1.2
    for (let r = step; r < g.rows - 1; r += step) {
      for (let c = step; c < g.cols - 1; c += step) {
        const x = g.originX + c * g.cell
        const y = g.originY + r * g.cell
        if (!pointInPolygon(x, y, green.outline)) continue
        const { gx, gy } = gradientAt(g, x, y)
        const mag = Math.hypot(gx, gy)
        if (mag < 0.004) continue
        const len = Math.min(0.9, 0.3 + mag * 8)
        const dx = (-gx / mag) * len
        const dy = (-gy / mag) * len
        const a = toCanvas(t, { x, y }, canvasH)
        const b = toCanvas(t, { x: x + dx, y: y + dy }, canvasH)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        // 箭头头部
        const ang = Math.atan2(b.y - a.y, b.x - a.x)
        ctx.beginPath()
        ctx.moveTo(b.x, b.y)
        ctx.lineTo(b.x - 5 * Math.cos(ang - 0.45), b.y - 5 * Math.sin(ang - 0.45))
        ctx.lineTo(b.x - 5 * Math.cos(ang + 0.45), b.y - 5 * Math.sin(ang + 0.45))
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  // 果岭轮廓
  ctx.strokeStyle = "#166534"
  ctx.lineWidth = 2
  ctx.beginPath()
  green.outline.forEach((p, i) => {
    const c = toCanvas(t, p, canvasH)
    if (i === 0) ctx.moveTo(c.x, c.y)
    else ctx.lineTo(c.x, c.y)
  })
  ctx.closePath()
  ctx.stroke()
}

export const drawCup = (ctx: CanvasRenderingContext2D, p: Vec2, scale: number): void => {
  const r = Math.max(4, 0.054 * scale * 2)
  ctx.fillStyle = "#0f172a"
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "#fff"
  ctx.lineWidth = 1.5
  ctx.stroke()
}

export const drawPin = (ctx: CanvasRenderingContext2D, p: Vec2, color: string, label?: string): void => {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "#fff"
  ctx.lineWidth = 1.5
  ctx.stroke()
  if (label) {
    ctx.fillStyle = "#0f172a"
    ctx.font = "12px system-ui"
    ctx.fillText(label, p.x + 8, p.y - 6)
  }
}
