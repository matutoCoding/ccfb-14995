// marching squares 等高线提取
import type { GridData } from "./grid"

export interface ContourSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  level: number
}

// 线性插值求等值点
const lerp = (a: number, b: number, va: number, vb: number, level: number): number =>
  (level - va) / (vb - va)

export const extractContours = (g: GridData, interval: number): ContourSegment[] => {
  let min = Infinity
  let max = -Infinity
  for (const h of g.heights) {
    if (h < min) min = h
    if (h > max) max = h
  }
  const segments: ContourSegment[] = []
  const xAt = (c: number) => g.originX + c * g.cell
  const yAt = (r: number) => g.originY + r * g.cell

  for (let level = Math.ceil(min / interval) * interval; level <= max; level += interval) {
    for (let r = 0; r < g.rows - 1; r++) {
      for (let c = 0; c < g.cols - 1; c++) {
        const v0 = g.heights[r * g.cols + c] // 左下
        const v1 = g.heights[r * g.cols + c + 1] // 右下
        const v2 = g.heights[(r + 1) * g.cols + c + 1] // 右上
        const v3 = g.heights[(r + 1) * g.cols + c] // 左上
        let idx = 0
        if (v0 > level) idx |= 1
        if (v1 > level) idx |= 2
        if (v2 > level) idx |= 4
        if (v3 > level) idx |= 8
        if (idx === 0 || idx === 15) continue

        // 各边交点(存在与否取决于 idx)
        const bottom = { x: xAt(c) + lerp(v0, v1, v0, v1, level) * g.cell, y: yAt(r) }
        const right = { x: xAt(c + 1), y: yAt(r) + lerp(v1, v2, v1, v2, level) * g.cell }
        const top = { x: xAt(c) + lerp(v3, v2, v3, v2, level) * g.cell, y: yAt(r + 1) }
        const left = { x: xAt(c), y: yAt(r) + lerp(v0, v3, v0, v3, level) * g.cell }

        const push = (a: { x: number; y: number }, b: { x: number; y: number }) =>
          segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, level })

        switch (idx) {
          case 1: case 14: push(left, bottom); break
          case 2: case 13: push(bottom, right); break
          case 3: case 12: push(left, right); break
          case 4: case 11: push(right, top); break
          case 5: push(left, top); push(bottom, right); break
          case 6: case 9: push(bottom, top); break
          case 7: case 8: push(left, top); break
          case 10: push(left, bottom); push(right, top); break
        }
      }
    }
  }
  return segments
}
