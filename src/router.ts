import { createRouter, createWebHashHistory } from "vue-router"

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/archive" },
    { path: "/archive", component: () => import("@/views/archive.vue"), meta: { title: "果岭档案" } },
    { path: "/terrain/:hole", component: () => import("@/views/terrain_editor.vue"), meta: { title: "地形编辑" } },
    { path: "/planner", component: () => import("@/views/pin_planner.vue"), meta: { title: "洞位规划" } },
    { path: "/planner/:hole", component: () => import("@/views/pin_planner.vue"), meta: { title: "洞位规划" } },
    { path: "/putt/:hole", component: () => import("@/views/putt_sim.vue"), meta: { title: "推杆模拟" } },
    { path: "/map/:hole", component: () => import("@/views/green_map.vue"), meta: { title: "赛事果岭图" } },
    { path: "/settings", component: () => import("@/views/settings.vue"), meta: { title: "设置" } },
  ],
})
