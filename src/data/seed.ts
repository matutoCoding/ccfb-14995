// 内置测试果岭:双层台、大斜坡、平+重草纹、马鞍复合,18 个球洞循环分配
import type { Green, Vec2 } from "@/types"
import { makeValueNoise } from "./rng"

interface Design {
  key: string
  name: string
  width: number
  depth: number
  grainStrength: number
  heightFn: (x: number, y: number, w: number, d: number, noise: (x: number, y: number) => number) => number
}

// 平滑台阶函数
const smoothstep = (t: number): number => {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

const DESIGNS: Design[] = [
  {
    // 双层台:中部一道 0.5m 的台阶把果岭分成上下两层
    key: "two-tier",
    name: "双层台",
    width: 24,
    depth: 26,
    grainStrength: 0.3,
    heightFn: (x, y, w, d, noise) => {
      const tier = 0.5 * smoothstep((y - d * 0.45) / (d * 0.12))
      const baseSlope = 0.012 * y
      const micro = (noise(x * 0.5, y * 0.5) - 0.5) * 0.06
      return tier + baseSlope + micro
    },
  },
  {
    // 大斜坡:整体 2.4% 单向坡加缓起伏,局部有 <3% 的可设洞区
    key: "big-slope",
    name: "大斜坡",
    width: 26,
    depth: 24,
    grainStrength: 0.35,
    heightFn: (x, y, w, d, noise) => {
      const main = 0.024 * y + 0.006 * x
      const roll = Math.sin((x / w) * Math.PI * 2) * 0.06
      const micro = (noise(x * 0.4, y * 0.4) - 0.5) * 0.04
      return main + roll + micro
    },
  },
  {
    // 平地重纹:几乎水平,草纹影响主导
    key: "flat-grain",
    name: "平地重纹",
    width: 22,
    depth: 24,
    grainStrength: 0.9,
    heightFn: (x, y, w, d, noise) => 0.004 * y + (noise(x * 0.6, y * 0.6) - 0.5) * 0.02,
  },
  {
    // 马鞍复合:中间脊线两侧泄水,读线最烧脑
    key: "saddle",
    name: "马鞍复合",
    width: 25,
    depth: 25,
    grainStrength: 0.4,
    heightFn: (x, y, w, d, noise) => {
      const nx = (x - w / 2) / (w / 2)
      const ny = (y - d / 2) / (d / 2)
      const saddle = 0.35 * (ny * ny - 0.6 * nx * nx)
      const micro = (noise(x * 0.45, y * 0.45) - 0.5) * 0.05
      return saddle + 0.01 * y + micro
    },
  },
]

// 有机果岭轮廓:半径随角度噪声变化
const makeOutline = (w: number, d: number, seed: number): Vec2[] => {
  const noise = makeValueNoise(seed)
  const pts: Vec2[] = []
  const n = 28
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = 1 + (noise(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 5) - 0.5) * 0.28
    pts.push({
      x: w / 2 + Math.cos(a) * (w / 2) * r * 0.96,
      y: d / 2 + Math.sin(a) * (d / 2) * r * 0.96,
    })
  }
  return pts
}

const CELL = 0.3

const buildGreen = (holeNo: number, design: Design, seed: number): Green => {
  const noise = makeValueNoise(seed * 7919 + 13)
  const outline = makeOutline(design.width, design.depth, seed * 104729 + 7)
  const cols = Math.ceil(design.width / CELL) + 1
  const rows = Math.ceil(design.depth / CELL) + 1
  const heights: number[] = new Array(cols * rows)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * CELL
      const y = r * CELL
      heights[r * cols + c] = Math.round(design.heightFn(x, y, design.width, design.depth, noise) * 10000) / 10000
    }
  }
  return {
    id: `hole-${holeNo}`,
    holeNo,
    name: `${holeNo} 号洞 · ${design.name}`,
    par: [4, 3, 5, 4][holeNo % 4],
    grid: { cols, rows, cell: CELL, originX: 0, originY: 0, heights },
    outline,
    approachDirDeg: 90, // 默认从南向北进攻(y 增方向为果岭深处)
    conditions: {
      stimpFt: 10.5,
      moisture: 0.3,
      grainStrength: design.grainStrength,
      grainDirDeg: (seed * 47) % 360,
    },
    surveyPoints: [],
  }
}

// 生成 18 个球洞:四种设计循环,种子按洞号派生,结果完全确定
export const makeSeedGreens = (): Green[] => {
  const greens: Green[] = []
  for (let hole = 1; hole <= 18; hole++) {
    const design = DESIGNS[(hole - 1) % DESIGNS.length]
    greens.push(buildGreen(hole, design, hole * 31 + 7))
  }
  return greens
}
