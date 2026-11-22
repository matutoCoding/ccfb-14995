<script setup lang="ts">
// 推杆模拟:任意点推杆 + 读线辅助 + 三推风险热区
import { computed, ref, watch } from "vue"
import { useRoute } from "vue-router"
import { state } from "@/data/store"
import { makeSampler } from "@/terrain/grid"
import { simulatePuttAt } from "@/physics/simulate"
import { solveReadLines, type ReadLine } from "@/planning/readline"
import { computeRiskField, type RiskCell } from "@/planning/risk"
import { CUP_RADIUS } from "@/physics/stimp"
import type { PuttResult, Vec2 } from "@/types"
import GreenCanvas from "@/components/green_canvas.vue"
import Green3d from "@/components/green_3d.vue"

const route = useRoute()
const holeNo = computed(() => Number(route.params.hole))
const green = computed(() => state.greens.find((g) => g.holeNo === holeNo.value))
const sampler = computed(() => (green.value ? makeSampler(green.value) : null))

const cup = ref<Vec2 | null>(null)
const start = ref<Vec2 | null>(null)
const pickMode = ref<"cup" | "start">("cup")
const speed = ref(2.5)
const angleDeg = ref(0)
const result = ref<PuttResult | null>(null)
const readLines = ref<ReadLine[]>([])
const showReadLines = ref(false)
const riskCells = ref<RiskCell[]>([])
const showRisk = ref(false)
const computing = ref(false)
const view3d = ref(false)

const OUTCOME_LABEL: Record<string, string> = {
  holed: "进洞",
  lipout: "擦边弹出",
  stopped: "停在果岭上",
  "off-green": "滑出果岭",
  timeout: "超时",
}

const pick = (pos: Vec2) => {
  if (pickMode.value === "cup") {
    cup.value = pos
    pickMode.value = "start"
  } else {
    start.value = pos
  }
  result.value = null
  readLines.value = []
}

const run = () => {
  if (!green.value || !sampler.value || !start.value) return
  result.value = simulatePuttAt(
    start.value,
    (angleDeg.value * Math.PI) / 180,
    speed.value,
    sampler.value,
    green.value.conditions,
    cup.value ? { pos: cup.value, radius: CUP_RADIUS } : undefined,
    state.settings.captureSpeed,
  )
}

const runReadLines = () => {
  if (!green.value || !sampler.value || !start.value || !cup.value) return
  computing.value = true
  // 异步让出主线程,避免界面卡死
  setTimeout(() => {
    readLines.value = solveReadLines(
      start.value!,
      { pos: cup.value!, radius: CUP_RADIUS },
      sampler.value!,
      green.value!.conditions,
      state.settings.captureSpeed,
    )
    showReadLines.value = true
    computing.value = false
  }, 30)
}

const runRisk = () => {
  if (!green.value || !sampler.value || !cup.value) return
  computing.value = true
  setTimeout(() => {
    const xs = green.value!.outline.map((p) => p.x)
    const ys = green.value!.outline.map((p) => p.y)
    riskCells.value = computeRiskField(
      { pos: cup.value!, radius: CUP_RADIUS },
      sampler.value!,
      green.value!.conditions,
      state.settings.captureSpeed,
      { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
      1,
      15,
    )
    showRisk.value = true
    computing.value = false
  }, 30)
}

const lines = computed(() => {
  const out: Array<{ points: Vec2[]; color: string; width?: number; dashed?: boolean }> = []
  if (showReadLines.value) {
    const colors = ["#2563eb", "#7c3aed", "#db2777"]
    readLines.value.forEach((l, i) => out.push({ points: l.result.points, color: colors[i % 3], width: 2 }))
  }
  if (result.value) out.push({ points: result.value.points, color: "#dc2626", width: 2.5 })
  return out
})

const trajectory3d = computed(() => result.value?.points ?? [])

const aimToCup = () => {
  if (!start.value || !cup.value) return
  angleDeg.value = (Math.atan2(cup.value.y - start.value.y, cup.value.x - start.value.x) * 180) / Math.PI
}

watch(green, () => {
  cup.value = null
  start.value = null
  result.value = null
  readLines.value = []
  riskCells.value = []
  showRisk.value = false
})
</script>

<template>
  <div v-if="green" class="flex flex-col gap-4">
    <div class="card p-4 flex flex-wrap items-center gap-4">
      <div class="flex gap-1">
        <button class="btn" :class="pickMode === 'cup' ? 'btn-primary' : ''" @click="pickMode = 'cup'">放洞杯</button>
        <button class="btn" :class="pickMode === 'start' ? 'btn-primary' : ''" @click="pickMode = 'start'">放球</button>
      </div>
      <div class="flex items-center gap-2">
        <span class="label mb-0!">初速 {{ speed.toFixed(2) }} m/s</span>
        <input v-model.number="speed" type="range" min="0.5" max="6" step="0.05" class="w-32 accent-emerald-700" />
      </div>
      <div class="flex items-center gap-2">
        <span class="label mb-0!">方向 {{ angleDeg.toFixed(0) }}°</span>
        <input v-model.number="angleDeg" type="range" min="-180" max="180" step="1" class="w-32 accent-emerald-700" />
        <button class="btn" :disabled="!start || !cup" @click="aimToCup">对准洞杯</button>
      </div>
      <button class="btn btn-primary" :disabled="!start" @click="run">推杆</button>
      <button class="btn" :disabled="!start || !cup || computing" @click="runReadLines">读线辅助</button>
      <button class="btn" :disabled="!cup || computing" @click="runRisk">三推风险</button>
      <button class="btn ml-auto" @click="view3d = !view3d">{{ view3d ? "2D 视图" : "3D 视图" }}</button>
    </div>

    <div class="flex gap-4">
      <div class="card p-4 flex-1 min-w-0">
        <Green3d v-if="view3d" :green="green" :cup="cup" :trajectory="trajectory3d" :height="540" />
        <GreenCanvas
          v-else
          :green="green"
          color-mode="slope"
          :show-contours="true"
          :cup="cup"
          :pins="start ? [{ pos: start, color: '#f8fafc', label: '球' }] : []"
          :lines="lines"
          :risk-cells="showRisk ? riskCells : undefined"
          :height="540"
          @pick="pick"
        />
      </div>

      <div class="w-72 shrink-0 flex flex-col gap-4">
        <div class="card p-4">
          <h3 class="font-medium text-slate-700 mb-3" :style="{ fontSize: 'var(--fs-base)' }">结果</h3>
          <template v-if="result">
            <div class="flex items-center gap-2 mb-3">
              <span
                class="tag"
                :class="result.outcome === 'holed' ? 'bg-emerald-100 text-emerald-800' : result.outcome === 'lipout' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'"
              >
                {{ OUTCOME_LABEL[result.outcome] }}
              </span>
            </div>
            <dl class="flex flex-col gap-2" :style="{ fontSize: 'var(--fs-xs)' }">
              <div class="flex justify-between"><dt class="text-slate-500">滚动距离</dt><dd class="font-medium">{{ result.distance.toFixed(2) }} m</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">滚动时间</dt><dd class="font-medium">{{ result.time.toFixed(1) }} s</dd></div>
              <div v-if="cup" class="flex justify-between">
                <dt class="text-slate-500">终点距洞</dt>
                <dd class="font-medium">{{ Math.hypot(result.end.x - cup.x, result.end.y - cup.y).toFixed(2) }} m</dd>
              </div>
            </dl>
          </template>
          <p v-else class="text-slate-400" :style="{ fontSize: 'var(--fs-xs)' }">先放球再推杆</p>
        </div>

        <div v-if="showReadLines && readLines.length" class="card p-4">
          <h3 class="font-medium text-slate-700 mb-3" :style="{ fontSize: 'var(--fs-base)' }">读线(瞄准点/力度)</h3>
          <div class="flex flex-col gap-3">
            <div v-for="l in readLines" :key="l.paceLabel" class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <span class="tag bg-slate-100 text-slate-700">{{ l.paceLabel }}</span>
                <span class="text-slate-500" :style="{ fontSize: 'var(--fs-xs)' }">过洞 {{ l.beyondM }}m</span>
              </div>
              <div class="text-slate-600" :style="{ fontSize: 'var(--fs-xs)' }">
                瞄准 {{ l.aimAngleDeg.toFixed(1) }}° · 初速 {{ l.speed.toFixed(2) }} m/s ·
                {{ l.result.outcome === "holed" ? "可进洞" : "接近" }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="showRisk" class="card p-4">
          <h3 class="font-medium text-slate-700 mb-2" :style="{ fontSize: 'var(--fs-base)' }">三推风险</h3>
          <div class="flex flex-col gap-1" :style="{ fontSize: 'var(--fs-xs)' }">
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-red-500/60" />剩余 &gt; 1m,高风险</div>
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-yellow-400/60" />剩余 0.5~1m,警戒</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="card p-8 text-center text-slate-500">球洞不存在</div>
</template>
