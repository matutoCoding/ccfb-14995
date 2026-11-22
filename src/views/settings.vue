<script setup lang="ts">
// 设置:全局参数 + 洞位历史浏览
import { computed, ref } from "vue"
import { state, saveSettings } from "@/data/store"
import { zoneOf, zoneLabel } from "@/planning/zones"

const saved = ref(false)
const filterHole = ref(0)

const save = () => {
  saveSettings()
  saved.value = true
  setTimeout(() => (saved.value = false), 2000)
}

const history = computed(() => {
  const list = state.pins
    .filter((p) => filterHole.value === 0 || p.holeNo === filterHole.value)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  return list.slice(0, 100).map((p) => {
    const g = state.greens.find((gr) => gr.holeNo === p.holeNo)
    return { ...p, zone: g ? zoneLabel(zoneOf(g, p.pos)) : "-" }
  })
})

// 每个洞位使用频次(磨损提醒)
const usageByHole = computed(() => {
  const map = new Map<number, number>()
  for (const p of state.pins) map.set(p.holeNo, (map.get(p.holeNo) ?? 0) + 1)
  return map
})
</script>

<template>
  <div class="flex flex-col gap-4 max-w-4xl">
    <div class="card p-5">
      <h3 class="font-medium text-slate-700 mb-4" :style="{ fontSize: 'var(--fs-base)' }">洞位规则</h3>
      <div class="grid grid-cols-2 gap-x-8 gap-y-4">
        <div>
          <label class="label">1m 内最大允许坡度(%)</label>
          <input v-model.number="state.settings.slopeLimitPct" type="number" step="0.5" min="1" max="6" class="input" @change="save" />
        </div>
        <div>
          <label class="label">距边缘最小步数</label>
          <input v-model.number="state.settings.edgeMinPaces" type="number" step="1" min="2" max="10" class="input" @change="save" />
        </div>
        <div>
          <label class="label">一步长度(米)</label>
          <input v-model.number="state.settings.paceLengthM" type="number" step="0.05" min="0.6" max="1.2" class="input" @change="save" />
        </div>
        <div>
          <label class="label">正心最大进洞速度(m/s)</label>
          <input v-model.number="state.settings.captureSpeed" type="number" step="0.1" min="0.8" max="2.5" class="input" @change="save" />
        </div>
        <div>
          <label class="label">重复使用提醒(天)</label>
          <input v-model.number="state.settings.pinReuseWarnDays" type="number" step="1" min="1" max="30" class="input" @change="save" />
        </div>
        <div>
          <label class="label">自动排洞禁用期(天)</label>
          <input v-model.number="state.settings.pinReuseBlockDays" type="number" step="1" min="0" max="30" class="input" @change="save" />
        </div>
        <div>
          <label class="label">等高线间距(米)</label>
          <input v-model.number="state.settings.contourIntervalM" type="number" step="0.05" min="0.05" max="0.5" class="input" @change="save" />
        </div>
      </div>
      <div v-if="saved" class="text-emerald-700 mt-3" :style="{ fontSize: 'var(--fs-xs)' }">已保存</div>
    </div>

    <div class="card p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-medium text-slate-700" :style="{ fontSize: 'var(--fs-base)' }">洞位历史</h3>
        <select v-model.number="filterHole" class="input w-32">
          <option :value="0">全部球洞</option>
          <option v-for="n in 18" :key="n" :value="n">{{ n }} 号洞</option>
        </select>
      </div>
      <p v-if="history.length === 0" class="text-slate-400" :style="{ fontSize: 'var(--fs-xs)' }">
        暂无记录,去洞位规划页生成或手动记录
      </p>
      <table v-else class="w-full" :style="{ fontSize: 'var(--fs-xs)' }">
        <thead>
          <tr class="text-left text-slate-500 border-b border-slate-200">
            <th class="py-2 font-medium">日期</th>
            <th class="font-medium">球洞</th>
            <th class="font-medium">区域</th>
            <th class="font-medium">坐标</th>
            <th class="font-medium">来源</th>
            <th class="font-medium">该洞累计</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in history" :key="p.id" class="border-b border-slate-100 text-slate-600">
            <td class="py-2">{{ p.date }}</td>
            <td>{{ p.holeNo }} 号</td>
            <td>{{ p.zone }}</td>
            <td>({{ p.pos.x.toFixed(1) }}, {{ p.pos.y.toFixed(1) }})</td>
            <td>{{ p.source === "auto" ? "自动" : "手动" }}</td>
            <td>
              <span :class="(usageByHole.get(p.holeNo) ?? 0) > 20 ? 'text-amber-600 font-medium' : ''">
                {{ usageByHole.get(p.holeNo) }} 次
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
