<script setup lang="ts">
import { useRoute } from "vue-router"
import { computed } from "vue"

const route = useRoute()
const title = computed(() => (route.meta.title as string) ?? "")

const nav = [
  { to: "/archive", label: "果岭档案", icon: "M4 6h16M4 12h16M4 18h16" },
  { to: "/planner", label: "洞位规划", icon: "M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" },
  { to: "/settings", label: "设置", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.5-3a7.5 7.5 0 0 1-.1 1.2l2 1.6-2 3.4-2.4-1a7.6 7.6 0 0 1-2 1.2l-.4 2.6h-4l-.4-2.6a7.6 7.6 0 0 1-2-1.2l-2.4 1-2-3.4 2-1.6a7.7 7.7 0 0 1 0-2.4l-2-1.6 2-3.4 2.4 1a7.6 7.6 0 0 1 2-1.2l.4-2.6h4l.4 2.6a7.6 7.6 0 0 1 2 1.2l2.4-1 2 3.4-2 1.6c.06.4.1.8.1 1.2z" },
]
</script>

<template>
  <div class="flex min-h-screen">
    <aside class="w-52 shrink-0 bg-slate-900 text-slate-300 flex flex-col">
      <div class="px-5 py-6">
        <div class="text-white font-semibold" :style="{ fontSize: 'var(--fs-lg)' }">果岭读线</div>
        <div class="text-slate-400 mt-1" :style="{ fontSize: 'var(--fs-xs)' }">洞位规划系统</div>
      </div>
      <nav class="flex-1 px-3 flex flex-col gap-1">
        <router-link
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors hover:bg-slate-800"
          :class="route.path.startsWith(item.to) ? 'bg-slate-800 text-white' : ''"
          :style="{ fontSize: 'var(--fs-xs)' }"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path :d="item.icon" />
          </svg>
          {{ item.label }}
        </router-link>
      </nav>
      <div class="px-5 py-4 text-slate-500" :style="{ fontSize: 'var(--fs-xs)' }">数据保存在本机浏览器</div>
    </aside>
    <main class="flex-1 min-w-0">
      <header class="bg-white border-b border-slate-200 px-6 py-4">
        <h1 class="font-semibold text-slate-800" :style="{ fontSize: 'var(--fs-xl)' }">{{ title }}</h1>
      </header>
      <div class="p-6">
        <router-view />
      </div>
    </main>
  </div>
</template>
