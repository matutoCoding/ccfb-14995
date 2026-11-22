// 确定性伪随机数(mulberry32):种子相同序列完全一致
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 值噪声(基于网格哈希,平滑插值),用于果岭微地形
export const makeValueNoise = (seed: number) => {
  const hash = (x: number, y: number): number => {
    let h = seed + x * 374761393 + y * 668265263
    h = (h ^ (h >> 13)) * 1274126177
    return (((h ^ (h >> 16)) >>> 0) % 10000) / 10000
  }
  const smooth = (t: number) => t * t * (3 - 2 * t)
  return (x: number, y: number): number => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const tx = smooth(x - x0)
    const ty = smooth(y - y0)
    const v00 = hash(x0, y0)
    const v10 = hash(x0 + 1, y0)
    const v01 = hash(x0, y0 + 1)
    const v11 = hash(x0 + 1, y0 + 1)
    return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty
  }
}
