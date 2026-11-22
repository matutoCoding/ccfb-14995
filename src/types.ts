// 全局类型定义

export interface Vec2 {
  x: number
  y: number
}

// 果岭状况:影响滚动的环境因子
export interface GreenConditions {
  stimpFt: number // 果岭速度值(英尺)
  moisture: number // 0=完全干燥 1=重露水
  grainStrength: number // 草纹强度 0..1
  grainDirDeg: number // 顺纹方向(草倒向),度
}

// 高度场采样器:返回高度与坡度梯度
export interface SurfaceSample {
  h: number
  gx: number // dh/dx
  gy: number // dh/dy
  onGreen: boolean
}

export type SurfaceSampler = (x: number, y: number) => SurfaceSample

export interface Cup {
  pos: Vec2
  radius: number // 标准洞杯半径 0.054m
}

export type PuttOutcome = "holed" | "lipout" | "stopped" | "off-green" | "timeout"

export interface PuttResult {
  points: Vec2[] // 轨迹点(抽稀)
  end: Vec2
  outcome: PuttOutcome
  time: number // 滚动时长 s
  distance: number // 轨迹总长 m
  closestToCup: number // 轨迹离洞杯中心最近距离(无洞时为 Infinity)
}

// 洞位记录
export interface PinPosition {
  id: string
  holeNo: number // 1..18
  pos: Vec2
  date: string // YYYY-MM-DD
  source: "manual" | "auto"
}

// 测量点(导入生成地形用)
export interface SurveyPoint {
  x: number
  y: number
  z: number
}

// 果岭档案
export interface Green {
  id: string
  holeNo: number
  name: string
  par: number
  // 地形网格
  grid: {
    cols: number
    rows: number
    cell: number // 网格边长 m
    originX: number
    originY: number
    heights: number[] // 行主序,长度 cols*rows
  }
  // 果岭轮廓多边形(本地坐标,m)
  outline: Vec2[]
  approachDirDeg: number // 进攻方向(用于前/后、左/右分区),度
  conditions: GreenConditions
  surveyPoints: SurveyPoint[] // 原始测量点(如有)
}

export interface AppSettings {
  paceLengthM: number // 一步多少米(赛事图步测)
  slopeLimitPct: number // 洞杯 1m 内允许最大坡度 %
  edgeMinPaces: number // 洞杯距前沿最小步数
  captureSpeed: number // 正心进洞最大速度 m/s
  pinReuseWarnDays: number // 同一位置重复使用告警天数
  pinReuseBlockDays: number // 自动排洞时禁用天数
  contourIntervalM: number // 等高线间距
}
