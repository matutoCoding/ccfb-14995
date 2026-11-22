// 地形手动编辑笔刷:抬升/下压/平滑/整平,全部直接作用于网格
import type { GridData } from "./grid"

export type BrushTool = "raise" | "lower" | "smooth" | "flatten"

// 高斯衰减笔刷,就地修改 heights
export const applyBrush = (
  g: GridData,
  cx: number,
  cy: number,
  radius: number,
  strength: number,
  tool: BrushTool,
  targetHeight?: number,
): void => {
  const c0 = Math.max(0, Math.floor((cx - radius - g.originX) / g.cell))
  const c1 = Math.min(g.cols - 1, Math.ceil((cx + radius - g.originX) / g.cell))
  const r0 = Math.max(0, Math.floor((cy - radius - g.originY) / g.cell))
  const r1 = Math.min(g.rows - 1, Math.ceil((cy + radius - g.originY) / g.cell))

  // 平滑先采样原值,避免顺序依赖
  const snapshot = tool === "smooth" ? g.heights.slice() : null

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = g.originX + c * g.cell
      const y = g.originY + r * g.cell
      const d = Math.hypot(x - cx, y - cy)
      if (d > radius) continue
      const fall = Math.exp(-(d * d) / (radius * radius * 0.35))
      const i = r * g.cols + c
      if (tool === "raise") g.heights[i] += strength * fall
      else if (tool === "lower") g.heights[i] -= strength * fall
      else if (tool === "flatten" && targetHeight !== undefined) {
        g.heights[i] += (targetHeight - g.heights[i]) * Math.min(1, strength * 4) * fall
      } else if (tool === "smooth" && snapshot) {
        // 3x3 均值向目标收敛
        let sum = 0
        let n = 0
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr
            const cc = c + dc
            if (rr < 0 || rr >= g.rows || cc < 0 || cc >= g.cols) continue
            sum += snapshot[rr * g.cols + cc]
            n++
          }
        }
        g.heights[i] += (sum / n - g.heights[i]) * Math.min(1, strength * 6) * fall
      }
    }
  }
}

// 整体倾斜:绕中心点加线性坡度(快速"拉坡")
export const applyTilt = (
  g: GridData,
  tiltX: number,
  tiltY: number,
): void => {
  const cx = g.originX + ((g.cols - 1) * g.cell) / 2
  const cy = g.originY + ((g.rows - 1) * g.cell) / 2
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const i = r * g.cols + c
      g.heights[i] += (g.originX + c * g.cell - cx) * tiltX + (g.originY + r * g.cell - cy) * tiltY
    }
  }
}
