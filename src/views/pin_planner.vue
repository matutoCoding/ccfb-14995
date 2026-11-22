<script setup lang="ts">
// 洞位规划:单洞合法性检查 + 18 洞自动均衡排洞
import { computed, ref } from "vue"
import { useRoute } from "vue-router"
import { state, addPins, pinUsageNear } from "@/data/store"
import { checkPinLegality } from "@/planning/legality"
import { generatePinSets, zoneOf, zoneLabel } from "@/planning/zones"
import type { PinPosition, Vec2 } from "@/types"
import GreenCanvas from "@/components/green_canvas.vue"

const route = useRoute()
const holeNo = ref(Number(route.params.hole ?? 1) || 1)
const green = computed(() => state.greens.find((g) => g.holeNo === holeNo.value))

const candidate = ref<Vec2 | null>(null)
const planDate = ref(new Date().toISOString().slice(0, 10))
const sets = ref<PinPosition[][]>([])
const activeSet = ref(-1)
const savedMsg = ref("")

const legality = computed(() =>
  green.value && candidate.value ? checkPinLegality(green.value, candidate.value, state.settings) : null,
)
const candidateZone = computed(() =>
  green.value && candidate.value ? zoneLabel(zoneOf(green.value, candidate.value)) : "",
)
const usage = computed(() =>
  candidate.value ? pinUsageNear(holeNo.value, candidate.value) : null,
)

// 当前方案在该洞的洞位
const planPin = computed(() => {
  if (activeSet.value < 0 || !sets.value[activeSet.value]) return null
  return sets.value[activeSet.value].find((p) => p.holeNo === holeNo.value) ?? null
})

const pins = computed(() => {
  const out: Array<{ pos: Vec2; color: string; label?: string }> = []
  if (planPin.value) out.push({ pos: planPin.value.pos, color: "#2563eb", label: "方案" })
  if (candidate.value) {
    out.push({ pos: candidate.value, color: legality.value?.ok ? "#dc2626" : "#f59e0b", label: candidateZone.value })
  }
  return out
})

const pick = (pos: Vec2) => {
  candidate.value = pos
  savedMsg.value = ""
}

const generate = () => {
  sets.value = generatePinSets(state.greens, state.settings, state.pins, 3, planDate.value)
  activeSet.value = sets.value.length > 0 ? 0 : -1
  savedMsg.value = sets.value.length === 0 ? "生成失败:合法洞位不足,请检查坡度限制设置" : ""
}

const saveSet = () => {
  const set = sets.value[activeSet.value]
  if (!set) return
  addPins(set.map((p) => ({ ...p, date: planDate.value })))
  savedMsg.value = `已把方案 ${activeSet.value + 1} 的 18 个洞位写入 ${planDate.value} 历史`
}

const saveSingle = () => {
  if (!candidate.value || !legality.value?.ok) return
  addPins([
    { id: `${planDate.value}-h${holeNo.value}-manual`, holeNo: holeNo.value, pos: candidate.value, date: planDate.value, source: "manual" },
  ])
  savedMsg.value = "已记录该洞位"
}

// 方案总览:九宫格分布统计
const setStats = computed(() => {
  if (activeSet.value < 0 || !sets.value[activeSet.value]) return []
  const set = sets.value[activeSet.value]
  const counts = new Map<string, number>()
  for (const p of set) {
    const g = state.greens.find((gr) => gr.holeNo === p.holeNo)
    if (!g) continue
    const z = zoneLabel(zoneOf(g, p.pos))
    counts.set(z, (counts.get(z) ?? 0) + 1)
  }
  return [...counts.entries()].map(([zone, count]) => ({ zone, count }))
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="card p-4 flex flex-wrap items-center gap-4">
      <div class="flex items-center gap-2">
        <span class="label mb-0!">球洞</span>
        <select v-model.number="holeNo" class="input w-24">
          <option v-for="n in 18" :key="n" :value="n">{{ n }} 号</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <span class="label mb-0!">日期</span>
        <input v-model="planDate" type="date" class="input w-40" />
      </div>
      <button class="btn btn-primary" @click="generate">自动生成 3 套方案</button>
      <div v-if="sets.length" class="flex items-center gap-1">
        <button
          v-for="(s, i) in sets"
          :key="i"
          class="btn"
          :class="i === activeSet ? 'btn-primary' : ''"
          @click="activeSet = i"
        >
          方案 {{ i + 1 }}
        </button>
        <button class="btn" @click="saveSet">采用该方案</button>
      </div>
      <span v-if="savedMsg" class="text-emerald-700" :style="{ fontSize: 'var(--fs-xs)' }">{{ savedMsg }}</span>
    </div>

    <div class="flex gap-4">
      <div class="card p-4 flex-1 min-w-0">
        <GreenCanvas
          v-if="green"
          :green="green"
          color-mode="slope"
          :show-contours="true"
          :show-arrows="true"
          :pins="pins"
          :height="540"
          @pick="pick"
        />
        <p class="text-slate-400 mt-2" :style="{ fontSize: 'var(--fs-xs)' }">点击果岭放置候选洞杯,自动检查 1m 内坡度与距边缘步数</p>
      </div>

      <div class="w-72 shrink-0 flex flex-col gap-4">
        <div class="card p-4">
          <h3 class="font-medium text-slate-700 mb-3" :style="{ fontSize: 'var(--fs-base)' }">候选洞位</h3>
          <template v-if="legality">
            <div class="flex items-center gap-2 mb-3">
              <span class="tag" :class="legality.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'">
                {{ legality.ok ? "合规" : "不合规" }}
              </span>
              <span class="text-slate-500" :style="{ fontSize: 'var(--fs-xs)' }">{{ candidateZone }}区</span>
            </div>
            <dl class="flex flex-col gap-2" :style="{ fontSize: 'var(--fs-xs)' }">
              <div class="flex justify-between"><dt class="text-slate-500">1m 内最大坡度</dt><dd class="font-medium">{{ legality.maxSlopePct.toFixed(2) }}%</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">1m 内平均坡度</dt><dd class="font-medium">{{ legality.avgSlopePct.toFixed(2) }}%</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">距边缘</dt><dd class="font-medium">{{ (legality.edgeDistM / state.settings.paceLengthM).toFixed(1) }} 步</dd></div>
            </dl>
            <ul v-if="legality.reasons.length" class="mt-3 text-red-600 flex flex-col gap-1" :style="{ fontSize: 'var(--fs-xs)' }">
              <li v-for="r in legality.reasons" :key="r">· {{ r }}</li>
            </ul>
            <div v-if="usage && usage.count > 0" class="mt-3 p-2 rounded-md bg-amber-50 text-amber-700" :style="{ fontSize: 'var(--fs-xs)' }">
              该位置 1.5m 内历史使用 {{ usage.count }} 次,最近 {{ usage.latest }},频繁使用易踩坏草皮
            </div>
            <button class="btn btn-primary w-full mt-4 justify-center" :disabled="!legality.ok" @click="saveSingle">记录该洞位</button>
          </template>
          <p v-else class="text-slate-400" :style="{ fontSize: 'var(--fs-xs)' }">尚未选择位置</p>
        </div>

        <div v-if="setStats.length" class="card p-4">
          <h3 class="font-medium text-slate-700 mb-3" :style="{ fontSize: 'var(--fs-base)' }">方案分布</h3>
          <div class="flex flex-wrap gap-1">
            <span v-for="s in setStats" :key="s.zone" class="tag bg-slate-100 text-slate-600">{{ s.zone }} × {{ s.count }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
