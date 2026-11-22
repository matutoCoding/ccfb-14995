<script setup lang="ts">
// 果岭档案:18 洞列表,状况设置,测量点导入
import { computed, ref } from "vue"
import { state, updateGreen } from "@/data/store"
import { parseSurveyCsv, gridFromPoints } from "@/terrain/from_points"
import type { Green } from "@/types"

const selectedHole = ref(1)
const green = computed(() => state.greens.find((g) => g.holeNo === selectedHole.value))
const importMsg = ref("")

const updateCond = (patch: Partial<Green["conditions"]>) => {
  if (!green.value) return
  updateGreen({ ...green.value, conditions: { ...green.value.conditions, ...patch } })
}

const onImport = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !green.value) return
  const reader = new FileReader()
  reader.onload = () => {
    const points = parseSurveyCsv(String(reader.result))
    if (points.length < 5) {
      importMsg.value = `只解析到 ${points.length} 个有效点,至少需要 5 个 (x,y,z)`
      return
    }
    const g = green.value!
    const grid = gridFromPoints(points, g.grid.cell, g.outline)
    updateGreen({
      ...g,
      grid: { ...grid, heights: Array.from(grid.heights) },
      surveyPoints: points,
    })
    importMsg.value = `已用 ${points.length} 个测量点重建地形`
  }
  reader.readAsText(file)
  ;(e.target as HTMLInputElement).value = ""
}

const moistureLabel = (m: number) => (m > 0.66 ? "重露水" : m > 0.33 ? "轻露水" : "干燥")
</script>

<template>
  <div class="flex gap-6">
    <div class="w-64 shrink-0 card p-3 self-start">
      <div class="label px-1">球洞</div>
      <div class="grid grid-cols-6 gap-1">
        <button
          v-for="n in 18"
          :key="n"
          class="h-9 rounded-md text-slate-600 transition-colors hover:bg-slate-100"
          :class="n === selectedHole ? 'bg-emerald-700! text-white!' : ''"
          :style="{ fontSize: 'var(--fs-xs)' }"
          @click="selectedHole = n"
        >
          {{ n }}
        </button>
      </div>
    </div>

    <div v-if="green" class="flex-1 flex flex-col gap-4">
      <div class="card p-5">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-semibold text-slate-800" :style="{ fontSize: 'var(--fs-lg)' }">{{ green.name }}</h2>
            <div class="text-slate-500 mt-1" :style="{ fontSize: 'var(--fs-xs)' }">
              标准杆 {{ green.par }} · 网格 {{ green.grid.cols }}×{{ green.grid.rows }} ·
              {{ green.surveyPoints.length > 0 ? `${green.surveyPoints.length} 个测量点` : "程序生成地形" }}
            </div>
          </div>
          <div class="flex gap-2">
            <router-link :to="`/terrain/${green.holeNo}`" class="btn">地形编辑</router-link>
            <router-link :to="`/putt/${green.holeNo}`" class="btn">推杆模拟</router-link>
            <router-link :to="`/map/${green.holeNo}`" class="btn btn-primary">赛事果岭图</router-link>
          </div>
        </div>
      </div>

      <div class="card p-5">
        <h3 class="font-medium text-slate-700 mb-4" :style="{ fontSize: 'var(--fs-base)' }">果岭状况</h3>
        <div class="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <label class="label">果岭速度(stimp,英尺):{{ green.conditions.stimpFt.toFixed(1) }}</label>
            <input
              type="range" min="7" max="14" step="0.1" class="w-full accent-emerald-700"
              :value="green.conditions.stimpFt"
              @input="updateCond({ stimpFt: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
          <div>
            <label class="label">湿度:{{ moistureLabel(green.conditions.moisture) }}</label>
            <input
              type="range" min="0" max="1" step="0.05" class="w-full accent-emerald-700"
              :value="green.conditions.moisture"
              @input="updateCond({ moisture: Number(($event.target as HTMLInputElement).value) })"
            />
            <div class="text-slate-400 mt-1" :style="{ fontSize: 'var(--fs-xs)' }">早晨露水调高,下午干燥调低</div>
          </div>
          <div>
            <label class="label">草纹强度:{{ (green.conditions.grainStrength * 100).toFixed(0) }}%</label>
            <input
              type="range" min="0" max="1" step="0.05" class="w-full accent-emerald-700"
              :value="green.conditions.grainStrength"
              @input="updateCond({ grainStrength: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
          <div>
            <label class="label">割草顺纹方向:{{ green.conditions.grainDirDeg.toFixed(0) }}°</label>
            <input
              type="range" min="0" max="359" step="1" class="w-full accent-emerald-700"
              :value="green.conditions.grainDirDeg"
              @input="updateCond({ grainDirDeg: Number(($event.target as HTMLInputElement).value) })"
            />
            <div class="text-slate-400 mt-1" :style="{ fontSize: 'var(--fs-xs)' }">0°=东 90°=北,顺纹快逆纹慢</div>
          </div>
        </div>
      </div>

      <div class="card p-5">
        <h3 class="font-medium text-slate-700 mb-2" :style="{ fontSize: 'var(--fs-base)' }">导入测量点</h3>
        <p class="text-slate-500 mb-3" :style="{ fontSize: 'var(--fs-xs)' }">
          CSV 格式:每行 x,y,z(米),坐标与果岭本地坐标一致。导入后按反距离加权重建地形网格。
        </p>
        <div class="flex items-center gap-3">
          <label class="btn cursor-pointer">
            选择 CSV 文件
            <input type="file" accept=".csv,.txt" class="hidden" @change="onImport" />
          </label>
          <span v-if="importMsg" class="text-slate-600" :style="{ fontSize: 'var(--fs-xs)' }">{{ importMsg }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
