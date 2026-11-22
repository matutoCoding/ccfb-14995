<script setup lang="ts">
// 3D 果岭视图:three.js 网格地形 + 顶点着色 + 轨迹线
import { onMounted, onBeforeUnmount, ref, watch } from "vue"
import { THREE, OrbitControls } from "@/lib/three"
import type { Green, Vec2 } from "@/types"
import { heightAt, pointInPolygon } from "@/terrain/grid"

const props = withDefaults(
  defineProps<{
    green: Green
    colorMode?: "slope" | "height"
    cup?: Vec2 | null
    trajectory?: Vec2[]
    height?: number
  }>(),
  { colorMode: "slope", cup: null, trajectory: () => [], height: 420 },
)

const wrapRef = ref<HTMLDivElement | null>(null)
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let controls: OrbitControls
let mesh: THREE.Mesh | null = null
let cupMesh: THREE.Mesh | null = null
let trajLine: THREE.Line | null = null
let raf = 0

const buildMesh = () => {
  if (mesh) {
    scene.remove(mesh)
    mesh.geometry.dispose()
    ;(mesh.material as THREE.Material).dispose()
  }
  const g = props.green.grid
  const geo = new THREE.PlaneGeometry(
    (g.cols - 1) * g.cell,
    (g.rows - 1) * g.cell,
    g.cols - 1,
    g.rows - 1,
  )
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const cx = ((g.cols - 1) * g.cell) / 2 + g.originX
  const cz = ((g.rows - 1) * g.cell) / 2 + g.originY
  let hMin = Infinity
  let hMax = -Infinity
  for (const h of g.heights) {
    hMin = Math.min(hMin, h)
    hMax = Math.max(hMax, h)
  }
  const color = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const gx = pos.getX(i) + cx
    const gz = pos.getZ(i) + cz
    const on = pointInPolygon(gx, gz, props.green.outline)
    const h = heightAt(g, gx, gz)
    pos.setY(i, on ? h : h - 0.25)
    if (props.colorMode === "height") {
      const t = (h - hMin) / (hMax - hMin || 1)
      color.setHSL(0.22 + 0.13 * t, 0.45, 0.62 - 0.25 * t)
    } else {
      const e = g.cell
      const sx = (heightAt(g, gx + e, gz) - heightAt(g, gx - e, gz)) / (2 * e)
      const sz = (heightAt(g, gx, gz + e) - heightAt(g, gx, gz - e)) / (2 * e)
      const pct = Math.min(1, (Math.hypot(sx, sz) * 100) / 5)
      color.setHSL(0.33 * (1 - pct), 0.6, 0.4)
    }
    if (!on) color.setHSL(0.3, 0.25, 0.3)
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }))
  scene.add(mesh)

  // 洞杯
  if (cupMesh) scene.remove(cupMesh)
  if (props.cup) {
    const h = heightAt(g, props.cup.x, props.cup.y)
    cupMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.054, 0.054, 0.02, 24),
      new THREE.MeshBasicMaterial({ color: 0x0f172a }),
    )
    cupMesh.position.set(props.cup.x - cx, h + 0.012, props.cup.y - cz)
    scene.add(cupMesh)
  }

  // 轨迹
  if (trajLine) scene.remove(trajLine)
  if (props.trajectory.length > 1) {
    const pts = props.trajectory.map(
      (p) => new THREE.Vector3(p.x - cx, heightAt(g, p.x, p.y) + 0.03, p.y - cz),
    )
    trajLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xdc2626 }),
    )
    scene.add(trajLine)
  }

  const w = (g.cols - 1) * g.cell
  controls.target.set(0, 0, 0)
  camera.position.set(0, w * 0.9, w * 0.8)
}

const animate = () => {
  raf = requestAnimationFrame(animate)
  controls.update()
  renderer?.render(scene, camera)
}

onMounted(() => {
  const wrap = wrapRef.value
  if (!wrap) return
  const w = wrap.clientWidth
  const h = props.height
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf1f5f9)
  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500)
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(window.devicePixelRatio)
  wrap.appendChild(renderer.domElement)
  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(30, 50, 20)
  scene.add(sun)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  buildMesh()
  animate()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  renderer?.dispose()
  renderer?.domElement.remove()
})

watch(() => [props.green, props.colorMode, props.cup, props.trajectory], buildMesh, { deep: true })
</script>

<template>
  <div ref="wrapRef" class="w-full overflow-hidden rounded-lg" :style="{ height: `${height}px` }" />
</template>
