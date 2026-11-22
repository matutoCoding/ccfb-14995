<script setup lang="ts">
// 2D 果岭画布:可切换等高线/坡度箭头/颜色模式,支持点击与拖拽取点
import { onMounted, onBeforeUnmount, ref, watch } from "vue"
import type { Green, Vec2 } from "@/types"
import type { RiskCell } from "@/planning/risk"
import { fitTransform, renderGreenBase, toGreen, drawCup, drawPin, type ViewTransform } from "@/terrain/render_2d"

export interface OverlayLine {
  points: Vec2[]
  color: string
  width?: number
  dashed?: boolean
}
export interface OverlayPin {
  pos: Vec2
  color?: string
  label?: string
}

const props = withDefaults(
  defineProps<{
    green: Green
    colorMode?: "none" | "slope" | "height"
    showContours?: boolean
    showArrows?: boolean
    contourInterval?: number
    cup?: Vec2 | null
    pins?: OverlayPin[]
    lines?: OverlayLine[]
    riskCells?: RiskCell[]
    height?: number
  }>(),
  {
    colorMode: "slope",
    showContours: true,
    showArrows: false,
    contourInterval: 0.1,
    cup: null,
    pins: () => [],
    lines: () => [],
    riskCells: undefined,
    height: 520,
  },
)

const emit = defineEmits<{
  pick: [pos: Vec2]
  drag: [pos: Vec2]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const wrapRef = ref<HTMLDivElement | null>(null)
let transform: ViewTransform | null = null
let dragging = false

const redraw = () => {
  const canvas = canvasRef.value
  const wrap = wrapRef.value
  if (!canvas || !wrap) return
  const w = wrap.clientWidth
  const h = props.height
  const dpr = window.devicePixelRatio || 1
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.fillStyle = "#f0fdf4"
  ctx.fillRect(0, 0, w, h)
  transform = fitTransform(props.green, w, h)
  renderGreenBase(ctx, props.green, transform, h, {
    colorMode: props.colorMode,
    showContours: props.showContours,
    showArrows: props.showArrows,
    contourInterval: props.contourInterval,
    riskCells: props.riskCells,
  })
  // 轨迹线
  for (const line of props.lines) {
    if (line.points.length < 2) continue
    ctx.strokeStyle = line.color
    ctx.lineWidth = line.width ?? 2
    ctx.setLineDash(line.dashed ? [6, 4] : [])
    ctx.beginPath()
    line.points.forEach((p, i) => {
      const c = { x: p.x * transform!.scale + transform!.offsetX, y: h - (p.y * transform!.scale + transform!.offsetY) }
      if (i === 0) ctx.moveTo(c.x, c.y)
      else ctx.lineTo(c.x, c.y)
    })
    ctx.stroke()
    ctx.setLineDash([])
  }
  // 洞位标记
  for (const pin of props.pins) {
    const c = { x: pin.pos.x * transform.scale + transform.offsetX, y: h - (pin.pos.y * transform.scale + transform.offsetY) }
    drawPin(ctx, c, pin.color ?? "#dc2626", pin.label)
  }
  // 洞杯
  if (props.cup) {
    const c = { x: props.cup.x * transform.scale + transform.offsetX, y: h - (props.cup.y * transform.scale + transform.offsetY) }
    drawCup(ctx, c, transform.scale)
  }
}

const eventPos = (e: MouseEvent): Vec2 | null => {
  const canvas = canvasRef.value
  if (!canvas || !transform) return null
  const rect = canvas.getBoundingClientRect()
  return toGreen(transform, { x: e.clientX - rect.left, y: e.clientY - rect.top }, props.height)
}

const onDown = (e: MouseEvent) => {
  dragging = true
  const p = eventPos(e)
  if (p) emit("pick", p)
}
const onMove = (e: MouseEvent) => {
  if (!dragging) return
  const p = eventPos(e)
  if (p) emit("drag", p)
}
const onUp = () => {
  dragging = false
}

let observer: ResizeObserver | null = null
onMounted(() => {
  redraw()
  if (wrapRef.value) {
    observer = new ResizeObserver(redraw)
    observer.observe(wrapRef.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())
watch(() => [props.green, props.colorMode, props.showContours, props.showArrows, props.cup, props.pins, props.lines, props.riskCells, props.contourInterval], redraw, { deep: true })
</script>

<template>
  <div ref="wrapRef" class="w-full">
    <canvas
      ref="canvasRef"
      class="block w-full rounded-lg cursor-crosshair"
      @mousedown="onDown"
      @mousemove="onMove"
      @mouseup="onUp"
      @mouseleave="onUp"
    />
  </div>
</template>
