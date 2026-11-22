<script setup lang="ts">
// 地形编辑:笔刷拉坡 + 整体倾斜 + 2D/3D 预览
import { computed, ref } from "vue"
import { useRoute } from "vue-router"
import { state, updateGreen } from "@/data/store"
import { applyBrush, applyTilt, type BrushTool } from "@/terrain/edit"
import { heightAt } from "@/terrain/grid"
import type { Vec2 } from "@/types"
import GreenCanvas from "@/components/green_canvas.vue"
import Green3d from "@/components/green_3d.vue"

const route = useRoute()
const holeNo = computed(() => Number(route.params.hole))
const green = computed(() => state.greens.find((g) => g.holeNo === holeNo.value))

const tool = ref<BrushTool>("raise")
const radius = ref(2)
const strength = ref(0.02)
const colorMode = ref<"slope" | "height">("height")
const view3d = ref(false)
const cursorH = ref<number | null>(null)
const tiltX = ref(0)
const tiltY = ref(0)

const tools: Array<{ key: BrushTool; label: string }> = [
  { key: "raise", label: "抬升" },
  { key: "lower", label: "下压" },
  { key: "smooth", label: "平滑" },
  { key: "flatten", label: "整平" },
]

// 笔刷直接改网格,再整体替换触发持久化
const brush = (pos: Vec2) => {
  const g = green.value
  if (!g) return
  const grid = { ...g.grid, heights: [...g.grid.heights] }
  applyBrush(grid, pos.x, pos.y, radius.value, strength.value, tool.value, heightAt(grid, pos.x, pos.y))
  updateGreen({ ...g, grid })
  cursorH.value = heightAt(grid, pos.x, pos.y)
}

const doTilt = () => {
  const g = green.value
  if (!g) return
  const grid = { ...g.grid, heights: [...g.grid.heights] }
  applyTilt(grid, tiltX.value / 100, tiltY.value / 100)
  updateGreen({ ...g, grid })
}
</script>

<template>
  <div v-if="green" class="flex flex-col gap-4">
    <div class="card p-4 flex flex-wrap items-center gap-4">
      <div class="flex gap-1">
        <button
          v-for="t in tools"
          :key="t.key"
          class="btn"
          :class="tool === t.key ? 'btn-primary' : ''"
          @click="tool = t.key"
        >
          {{ t.label }}
        </button>
      </div>
      <div class="flex items-center gap-2">
        <span class="label mb-0!">半径 {{ radius.toFixed(1) }}m</span>
        <input v-model.number="radius" type="range" min="0.5" max="6" step="0.5" class="w-24 accent-emerald-700" />
      </div>
      <div class="flex items-center gap-2">
        <span class="label mb-0!">力度 {{ (strength * 100).toFixed(0) }}%</span>
        <input v-model.number="strength" type="range" min="0.005" max="0.1" step="0.005" class="w-24 accent-emerald-700" />
      </div>
      <div class="flex items-center gap-2 ml-auto">
        <button class="btn" :class="colorMode === 'height' ? 'btn-primary' : ''" @click="colorMode = 'height'">高度</button>
        <button class="btn" :class="colorMode === 'slope' ? 'btn-primary' : ''" @click="colorMode = 'slope'">坡度</button>
        <button class="btn" @click="view3d = !view3d">{{ view3d ? "2D 视图" : "3D 视图" }}</button>
      </div>
    </div>

    <div class="card p-4 flex flex-wrap items-end gap-4">
      <div>
        <label class="label">整体倾斜 X(%)</label>
        <input v-model.number="tiltX" type="number" step="0.1" class="input w-28" />
      </div>
      <div>
        <label class="label">整体倾斜 Y(%)</label>
        <input v-model.number="tiltY" type="number" step="0.1" class="input w-28" />
      </div>
      <button class="btn" @click="doTilt">应用倾斜</button>
      <span v-if="cursorH !== null" class="text-slate-500 ml-auto" :style="{ fontSize: 'var(--fs-xs)' }">
        笔刷处高度 {{ cursorH.toFixed(3) }} m
      </span>
    </div>

    <div class="card p-4">
      <Green3d v-if="view3d" :green="green" :color-mode="colorMode" :height="560" />
      <GreenCanvas
        v-else
        :green="green"
        :color-mode="colorMode"
        :show-contours="true"
        :height="560"
        @pick="brush"
        @drag="brush"
      />
      <p class="text-slate-400 mt-2" :style="{ fontSize: 'var(--fs-xs)' }">在图上按住拖动即可用笔刷修改地形,修改自动保存</p>
    </div>
  </div>
  <div v-else class="card p-8 text-center text-slate-500">球洞不存在</div>
</template>
