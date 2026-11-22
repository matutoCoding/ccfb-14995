// 测量点 -> 高度网格:反距离加权(IDW)插值
import type { SurveyPoint, Vec2 } from "@/types"
import type { GridData } from "./grid"

// 由散点生成规则网格,超出点集覆盖范围的格点用最近点趋势外延
export const gridFromPoints = (
  points: SurveyPoint[],
  cell: number,
  outline: Vec2[],
): GridData => {
  const xs = outline.map((p) => p.x)
  const ys = outline.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const cols = Math.max(2, Math.ceil((maxX - minX) / cell) + 1)
  const rows = Math.max(2, Math.ceil((maxY - minY) / cell) + 1)
  const heights = new Array<number>(cols * rows)

  // 简单网格哈希加速最近点查询
  const bucketSize = Math.max(2, cell * 4)
  const buckets = new Map<string, number[]>()
  points.forEach((p, i) => {
    const key = `${Math.floor(p.x / bucketSize)}_${Math.floor(p.y / bucketSize)}`
    const arr = buckets.get(key)
    if (arr) arr.push(i)
    else buckets.set(key, [i])
  })

  const idw = (x: number, y: number): number => {
    let wSum = 0
    let vSum = 0
    const bx = Math.floor(x / bucketSize)
    const by = Math.floor(y / bucketSize)
    // 逐圈扩大搜索范围直到有足够样本
    for (let ring = 1; ring <= 8; ring++) {
      wSum = 0
      vSum = 0
      let count = 0
      for (let ix = bx - ring; ix <= bx + ring; ix++) {
        for (let iy = by - ring; iy <= by + ring; iy++) {
          const arr = buckets.get(`${ix}_${iy}`)
          if (!arr) continue
          for (const i of arr) {
            const p = points[i]
            const d2 = (p.x - x) ** 2 + (p.y - y) ** 2
            if (d2 < 1e-9) return p.z
            const w = 1 / d2
            wSum += w
            vSum += w * p.z
            count++
          }
        }
      }
      if (count >= 4) return vSum / wSum
    }
    return wSum > 0 ? vSum / wSum : 0
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      heights[r * cols + c] = idw(minX + c * cell, minY + r * cell)
    }
  }
  return { cols, rows, cell, originX: minX, originY: minY, heights }
}

// 解析 CSV 测量点:x,y,z 每行一个(支持表头与分号/制表符)
export const parseSurveyCsv = (text: string): SurveyPoint[] => {
  const out: SurveyPoint[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split(/[,;\t]/).map((s) => s.trim())
    if (parts.length < 3) continue
    const x = Number(parts[0])
    const y = Number(parts[1])
    const z = Number(parts[2])
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) out.push({ x, y, z })
  }
  return out
}
