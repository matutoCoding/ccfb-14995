<script setup lang="ts">
// 赛事果岭图:规范出图,洞位步测标注,可打印
import { computed, onMounted, ref, watch } from "vue"
import { useRoute } from "vue-router"
import { state } from "@/data/store"
import { extractContours } from "@/terrain/contour"
import { fitTransform, toCanvas } from "@/terrain/render_2d"
import { zoneOf, zoneLabel } from "@/planning/zones"
import type { Vec2 } from "@/types"

const route = useRoute()
const holeNo = computed(() => Number(route.params.hole))
const green = computed(() => state.greens.find((g) => g.holeNo === holeNo.value))

const canvasRef = ref<HTMLCanvasElement | null>(null)
const cup = ref<Vec2 | null>(null)
const mapDate = ref(new Date().toISOString().slice(0, 10))

// 取该洞最近一次的洞位历史作为默认洞杯
const latestPin = computed(() => {
  const pins = state.pins.filter((p) => p.holeNo === holeNo.value).sort((a, b) => (a.date < b.date ? 1 : -1))
  return pins[0] ?? null
})

// 沿进攻方向的深度投影
const depthInfo = computed(() => {
  const g = green.value
  if (!g || !cup.value) return null
  const rad = (g.approachDirDeg * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const cx = g.outline.reduce((s, p) => s + p.x, 0) / g.outline.length
  const cy = g.outline.reduce((s, p) => s + p.y, 0) / g.outline.length
  const proj = (p: Vec2) => (p.x - cx) * dx + (p.y - cy) * dy
  const sideProj = (p: Vec2) => -(p.x - cx) * dy + (p.y - cy) * dx
  const dVals = g.outline.map(proj)
  const sVals = g.outline.map(sideProj)
  const front = Math.min(...dVals)
  const back = Math.max(...dVals)
  const sMin = Math.min(...sVals)
  const sMax = Math.max(...sVals)
  const pace = state.settings.paceLengthM
  const cupDepth = proj(cup.value)
  const cupSide = sideProj(cup.value)
  return {
    fromFront: Math.round((cupDepth - front) / pace),
    fromBack: Math.round((back - cupDepth) / pace),
    fromLeft: Math.round((cupSide - sMin) / pace),
    fromRight: Math.round((sMax - cupSide) / pace),
    depthTotal: Math.round((back - front) / pace),
    zone: zoneLabel(zoneOf(g, cup.value)),
  }
})

const draw = () => {
  const canvas = canvasRef.value
  const g = green.value
  if (!canvas || !g) return
  const W = 800
  const H = 1000
  const dpr = window.devicePixelRatio || 1
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = "100%"
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, W, H)

  // 标题栏
  ctx.fillStyle = "#0f172a"
  ctx.font = "600 26px system-ui"
  ctx.fillText(`第 ${g.holeNo} 洞 果岭图`, 40, 52)
  ctx.font = "14px system-ui"
  ctx.fillStyle = "#64748b"
  ctx.fillText(`标准杆 ${g.par} · 果岭速度 ${g.conditions.stimpFt.toFixed(1)} ft · ${mapDate.value}`, 40, 78)

  // 果岭区域
  const mapTop = 110
  const mapH = 700
  const t = fitTransform(g, W - 80, mapH - 40, 30)
  const toC = (p: Vec2) => {
    const c = toCanvas(t, p, mapH)
    return { x: c.x + 40, y: c.y + mapTop }
  }

  // 5m 参考网格
  ctx.strokeStyle = "#e2e8f0"
  ctx.lineWidth = 1
  const xs = g.outline.map((p) => p.x)
  const ys = g.outline.map((p) => p.y)
  for (let x = Math.floor(Math.min(...xs) / 5) * 5; x <= Math.max(...xs); x += 5) {
    const a = toC({ x, y: Math.min(...ys) })
    const b = toC({ x, y: Math.max(...ys) })
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  }
  for (let y = Math.floor(Math.min(...ys) / 5) * 5; y <= Math.max(...ys); y += 5) {
    const a = toC({ x: Math.min(...xs), y })
    const b = toC({ x: Math.max(...xs), y })
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  }

  // 果岭填充与轮廓
  ctx.beginPath()
  g.outline.forEach((p, i) => {
    const c = toC(p)
    if (i === 0) ctx.moveTo(c.x, c.y)
    else ctx.lineTo(c.x, c.y)
  })
  ctx.closePath()
  ctx.fillStyle = "#dcfce7"
  ctx.fill()
  ctx.strokeStyle = "#166534"
  ctx.lineWidth = 2.5
  ctx.stroke()

  // 等高线(裁剪到果岭内)
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = "rgba(22, 101, 52, 0.5)"
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const s of extractContours(g.grid, state.settings.contourIntervalM)) {
    const a = toC({ x: s.x1, y: s.y1 })
    const b = toC({ x: s.x2, y: s.y2 })
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.stroke()
  ctx.restore()

  // 进攻方向箭头(图下方)
  const rad = (g.approachDirDeg * Math.PI) / 180
  const arrowCx = W - 90
  const arrowCy = 60
  ctx.strokeStyle = "#0f172a"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(arrowCx - Math.cos(rad) * 22, arrowCy + Math.sin(rad) * 22)
  ctx.lineTo(arrowCx + Math.cos(rad) * 22, arrowCy - Math.sin(rad) * 22)
  ctx.stroke()
  ctx.fillStyle = "#0f172a"
  ctx.font = "12px system-ui"
  ctx.fillText("进攻方向", arrowCx - 26, arrowCy + 42)

  // 洞杯与步测标注
  if (cup.value && depthInfo.value) {
    const c = toC(cup.value)
    ctx.fillStyle = "#dc2626"
    ctx.beginPath()
    ctx.arc(c.x, c.y, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "#fff"
    ctx.lineWidth = 2
    ctx.stroke()
    // 前沿步测线
    const frontC = toC({ x: cup.value.x, y: Math.min(...ys) })
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = "#dc2626"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(c.x, c.y)
    ctx.lineTo(c.x, frontC.y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // 底部信息栏
  if (depthInfo.value) {
    const d = depthInfo.value
    ctx.fillStyle = "#0f172a"
    ctx.font = "600 18px system-ui"
    ctx.fillText(`洞位:${d.zone}区`, 40, 870)
    ctx.font = "16px system-ui"
    ctx.fillStyle = "#334155"
    ctx.fillText(`距前沿 ${d.fromFront} 步 · 距后沿 ${d.fromBack} 步 · 距左侧 ${d.fromLeft} 步 · 距右侧 ${d.fromRight} 步`, 40, 900)
    ctx.fillText(`果岭纵深 ${d.depthTotal} 步 · 1 步 = ${state.settings.paceLengthM} m`, 40, 928)
  } else {
    ctx.fillStyle = "#94a3b8"
    ctx.font = "16px system-ui"
    ctx.fillText("在图上点击放置洞杯,或先在洞位规划中记录洞位", 40, 880)
  }
}

const onClick = (e: MouseEvent) => {
  const canvas = canvasRef.value
  const g = green.value
  if (!canvas || !g) return
  const rect = canvas.getBoundingClientRect()
  const W = 800
  const mapTop = 110
  const mapH = 700
  const scaleX = W / rect.width
  const px = (e.clientX - rect.left) * scaleX - 40
  const py = (e.clientY - rect.top) * scaleX - mapTop
  const t = fitTransform(g, W - 80, mapH - 40, 30)
  cup.value = { x: (px - t.offsetX) / t.scale, y: (mapH - py - t.offsetY) / t.scale }
  draw()
}

const useLatestPin = () => {
  if (latestPin.value) {
    cup.value = { ...latestPin.value.pos }
    draw()
  }
}

onMounted(() => {
  if (latestPin.value) cup.value = { ...latestPin.value.pos }
  draw()
})
watch([green, mapDate], draw)
</script>

<template>
  <div v-if="green" class="flex flex-col gap-4">
    <div class="card p-4 flex flex-wrap items-center gap-4 no-print">
      <div class="flex items-center gap-2">
        <span class="label mb-0!">球洞</span>
        <select class="input w-24" :value="holeNo" @change="$router.push(`/map/${Number(($event.target as HTMLSelectElement).value)}`)">
          <option v-for="n in 18" :key="n" :value="n">{{ n }} 号</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <span class="label mb-0!">日期</span>
        <input v-model="mapDate" type="date" class="input w-40" />
      </div>
      <button class="btn" :disabled="!latestPin" @click="useLatestPin">取最近洞位</button>
      <button class="btn btn-primary ml-auto" @click="() => window.print()">打印</button>
    </div>
    <div id="print-area" class="card p-4">
      <canvas ref="canvasRef" class="block cursor-crosshair" @click="onClick" />
    </div>
  </div>
  <div v-else class="card p-8 text-center text-slate-500">球洞不存在</div>
</template>
