/**
 * Visionneuse 3D du plan de salle : rendu three à la demande (la boucle ne tourne que pendant un
 * mouvement, un amortissement ou une animation), caméra orbitale, survol et clic sur les tables.
 * Indépendante de Vue : le composant `Floor3DView` la pilote avec `update()`.
 */
import * as THREE from 'three'
// eslint-disable-next-line import/extensions -- le paquet three n'expose ces modules qu'avec l'extension
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildScene } from './buildScene'
import type { SceneBuild } from './buildScene'
import { LEVEL_D, LEVEL_GAP, LEVEL_W, SLAB_T, framing, isPortrait, levelElevation, stateKey, structureKey } from './geometry'
import type { Scene3DLevel, ViewMode } from './sceneTypes'

export interface ViewerInput {
  levels: readonly Scene3DLevel[]
  mode: ViewMode
  levelId: string | null
  selectedId: string | null
  dark: boolean
}

export interface ViewerCallbacks {
  select: (id: string) => void
  hover: (id: string | null) => void
}

export type ViewKind = 'top' | 'perspective' | 'reset'

const FOV = 40
const TILT = THREE.MathUtils.degToRad(40)

/** Immeuble : on regarde plus d'en haut pour que chaque étage reste lisible sous celui du dessus. */
const TILT_BUILDING = THREE.MathUtils.degToRad(54)
const ANIM_MS = 400

interface Animation {
  fromPos: THREE.Vector3
  toPos: THREE.Vector3
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
  start: number
  duration: number
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export class FloorViewer {
  /** WebGL est-il disponible ici ? (navigateurs sans accélération, tests, etc.) */
  static supported(): boolean {
    try {
      const canvas = document.createElement('canvas')

      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
    }
    catch {
      return false
    }
  }

  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400)
  private controls: OrbitControls
  private sun = new THREE.DirectionalLight(0xFFFFFF, 2.1)
  private hemi = new THREE.HemisphereLight(0xFFFFFF, 0x8A90A0, 1.5)
  private ground: THREE.Mesh | null = null
  private groundTexture: THREE.CanvasTexture | null = null
  private build: SceneBuild | null = null
  private input: ViewerInput | null = null
  private structKey = ''
  private statesKey = ''
  private lastMode: ViewMode | null = null
  private lastFocus: string | null = null
  private lastLevelId: string | null = null
  private framed = false
  private userInteracted = false
  private kind: 'top' | 'perspective' = 'perspective'
  private raf = 0
  private dirty = true
  private interacting = false
  private anim: Animation | null = null
  private observer: ResizeObserver
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private down: { x: number; y: number; t: number } | null = null
  private hoverId: string | null = null
  private hoverPending: { x: number; y: number } | null = null
  private hoverRaf = 0
  private disposed = false

  constructor(private host: HTMLElement, private callbacks: ViewerCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const canvas = this.renderer.domElement

    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.touchAction = 'none'
    canvas.style.outline = 'none'
    host.appendChild(canvas)

    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.03
    this.sun.shadow.radius = 4

    const cam = this.sun.shadow.camera

    cam.left = -26
    cam.right = 26
    cam.top = 26
    cam.bottom = -26
    cam.near = 1
    cam.far = 140
    this.scene.add(this.hemi, this.sun, this.sun.target)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.09
    this.controls.minDistance = 5
    this.controls.maxDistance = 150
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03
    this.controls.addEventListener('start', this.onStart)
    this.controls.addEventListener('end', this.onEnd)
    this.controls.addEventListener('change', this.requestRender)

    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerleave', this.onPointerLeave)
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(host)
    this.resize()
  }

  // ---- données

  update(input: ViewerInput) {
    if (this.disposed)
      return

    const prev = this.input

    this.input = input

    const key = `${structureKey(input.levels, input.mode, input.levelId)}|${input.dark ? 'D' : 'L'}`

    if (key !== this.structKey || !this.build) {
      this.rebuild(input, key)
    }
    else {
      const states = stateKey(input.levels)

      if (states !== this.statesKey) {
        this.build.applyStates(input.levels)
        this.statesKey = states
      }

      // Immeuble : le niveau mis en avant change sans rebâtir (les autres s'estompent, ceux du dessus s'écartent).
      if (input.mode === 'building' && input.levelId !== this.lastFocus)
        this.applyFocus(input)
    }

    this.build?.setSelected(input.selectedId)

    if (prev && prev.selectedId !== input.selectedId)
      this.requestRender()

    this.requestRender()
  }

  private rebuild(input: ViewerInput, key: string) {
    this.build?.dispose()
    this.build = buildScene(input.levels, { dark: input.dark, mode: input.mode, levelId: input.levelId })
    this.scene.add(this.build.root)
    this.structKey = key
    this.statesKey = stateKey(input.levels)
    this.lastFocus = input.mode === 'building' ? input.levelId : null
    this.scene.background = new THREE.Color(input.dark ? 0x15161C : 0xEEF0F4)
    this.hemi.color.set(input.dark ? 0xDDE3F5 : 0xFFFFFF)
    this.hemi.groundColor.set(input.dark ? 0x3B3F4C : 0x8A90A0)
    this.hemi.intensity = input.dark ? 1.2 : 1.55
    this.sun.intensity = input.dark ? 1.7 : 2.1
    this.buildGround(input)
    this.hoverId = null
    this.callbacks.hover(null)

    const modeChanged = this.lastMode !== input.mode
    const levelChanged = input.mode === 'level' && this.lastLevelId !== input.levelId

    this.lastMode = input.mode
    this.lastLevelId = input.levelId

    if (!this.framed || modeChanged || levelChanged) {
      this.userInteracted = false
      this.frame(this.kind, this.framed)
    }
  }

  /** Disque d'ombre douce sous le bâtiment : ancre visuellement la dalle. */
  private buildGround(input: ViewerInput) {
    if (this.ground) {
      this.scene.remove(this.ground)
      this.ground.geometry.dispose();
      (this.ground.material as THREE.Material).dispose()
      this.groundTexture?.dispose()
    }

    const canvas = document.createElement('canvas')

    canvas.width = 256
    canvas.height = 256

    const ctx = canvas.getContext('2d')

    if (ctx) {
      const gradient = ctx.createRadialGradient(128, 128, 20, 128, 128, 128)

      gradient.addColorStop(0, input.dark ? 'rgba(0,0,0,0.55)' : 'rgba(40,45,60,0.22)')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 256, 256)
    }

    this.groundTexture = new THREE.CanvasTexture(canvas)

    const material = new THREE.MeshBasicMaterial({ map: this.groundTexture, transparent: true, depthWrite: false })

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(LEVEL_W * 1.35, LEVEL_D * 1.7), material)
    this.ground.rotation.x = -Math.PI / 2
    this.ground.position.y = -SLAB_T - 0.04
    this.ground.renderOrder = -1
    this.scene.add(this.ground)
  }

  private applyFocus(input: ViewerInput) {
    if (!this.build)
      return

    const before = this.lastFocus
    const after = input.levelId

    this.build.setFocus(after)
    this.lastFocus = after

    // Le cadre suit le niveau mis en avant : on décale caméra et cible de la même hauteur.
    const index = (id: string | null) => this.build!.levels.findIndex(level => level.id === id)
    const elevation = (id: string | null) => (index(id) >= 0 ? levelElevation(index(id), index(id)) : 0)
    const dy = elevation(after) - elevation(before)

    if (dy !== 0 && this.framed)
      this.animateTo(this.camera.position.clone().add(new THREE.Vector3(0, dy, 0)), this.controls.target.clone().add(new THREE.Vector3(0, dy, 0)))

    this.requestRender()
  }

  // ---- caméra

  private levelCount() {
    return Math.max(this.build?.levels.length ?? 1, 1)
  }

  private pose(kind: 'top' | 'perspective'): { pos: THREE.Vector3; target: THREE.Vector3 } {
    const mode = this.input?.mode ?? 'level'
    const aspect = this.camera.aspect || 1.6
    const fit = framing(this.levelCount(), mode, FOV, aspect, kind === 'perspective')
    const target = new THREE.Vector3(fit.target.x, fit.target.y, fit.target.z)

    // Immeuble avec un niveau mis en avant : le cadre est centré sur lui.
    if (mode === 'building' && this.input?.levelId && this.build) {
      const index = this.build.levels.findIndex(level => level.id === this.input!.levelId)

      if (index >= 0)
        target.y = Math.max(0.4, levelElevation(index, index) + 0.4) * 0.5 + target.y * 0.5
    }

    const tilt = mode === 'building' ? TILT_BUILDING : TILT

    // Portrait : la caméra se place sur le côté pour que la grande dimension de la salle monte dans l'écran.
    const portrait = isPortrait(aspect)

    const dir = kind === 'top'
      ? (portrait ? new THREE.Vector3(0.02, 1, 0) : new THREE.Vector3(0, 1, 0.02)).normalize()
      : (portrait ? new THREE.Vector3(Math.cos(tilt), Math.sin(tilt), 0) : new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt)))

    return { pos: target.clone().addScaledVector(dir, fit.distance), target }
  }

  private frame(kind: 'top' | 'perspective', animate: boolean) {
    const { pos, target } = this.pose(kind)

    this.framed = true
    this.kind = kind

    if (animate)
      this.animateTo(pos, target)
    else
      this.jumpTo(pos, target)
  }

  setView(kind: ViewKind) {
    this.userInteracted = false
    this.frame(kind === 'top' ? 'top' : 'perspective', true)
  }

  private jumpTo(pos: THREE.Vector3, target: THREE.Vector3) {
    this.anim = null
    this.camera.position.copy(pos)
    this.controls.target.copy(target)
    this.controls.update()
    this.updateSun()
    this.requestRender()
  }

  private animateTo(pos: THREE.Vector3, target: THREE.Vector3) {
    if (reducedMotion()) {
      this.jumpTo(pos, target)

      return
    }

    this.anim = {
      fromPos: this.camera.position.clone(),
      toPos: pos,
      fromTarget: this.controls.target.clone(),
      toTarget: target,
      start: performance.now(),
      duration: ANIM_MS,
    }
    this.requestRender()
  }

  private updateSun() {
    const height = (this.levelCount() - 1) * LEVEL_GAP

    this.sun.target.position.set(0, height / 2, 0)
    this.sun.position.set(-16, height / 2 + 38, 22)
    this.sun.target.updateMatrixWorld()
  }

  // ---- rendu à la demande

  requestRender = () => {
    this.dirty = true

    if (!this.raf && !this.disposed)
      this.raf = requestAnimationFrame(this.tick)
  }

  private tick = (now: number) => {
    this.raf = 0

    if (this.disposed)
      return

    let more = false

    if (this.anim) {
      const a = this.anim
      const t = Math.min(1, (now - a.start) / a.duration)
      const e = 1 - (1 - t) ** 3

      this.camera.position.lerpVectors(a.fromPos, a.toPos, e)
      this.controls.target.lerpVectors(a.fromTarget, a.toTarget, e)

      if (t >= 1)
        this.anim = null
      else
        more = true
    }

    const moved = this.controls.update()

    if (moved || this.interacting)
      more = true

    if (this.dirty || moved || more) {
      this.updateSun()
      this.renderer.render(this.scene, this.camera)
      this.dirty = false
    }

    if (more)
      this.raf = requestAnimationFrame(this.tick)
  }

  private onStart = () => {
    this.interacting = true
    this.userInteracted = true
    this.anim = null
    this.requestRender()
  }

  private onEnd = () => {
    this.interacting = false
    this.requestRender()
  }

  private resize() {
    const width = this.host.clientWidth
    const height = this.host.clientHeight

    if (width < 2 || height < 2)
      return

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    // Tant que personne n'a touché à la caméra, un changement de taille recadre la scène.
    if (this.input && this.build && !this.userInteracted)
      this.frame(this.kind, false)

    this.requestRender()
  }

  // ---- souris et doigts

  private ndc(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect()

    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
  }

  private pick(): string | null {
    if (!this.build)
      return null

    this.raycaster.setFromCamera(this.pointer, this.camera)

    const hits = this.raycaster.intersectObjects(this.build.pickables(), false)

    for (const hit of hits) {
      if (hit.instanceId === undefined)
        continue

      const id = this.build.tableIdAt(hit.object as THREE.InstancedMesh, hit.instanceId)

      if (id)
        return id
    }

    return null
  }

  private setHover(id: string | null) {
    if (id === this.hoverId)
      return

    this.hoverId = id
    this.build?.setHover(id)
    this.renderer.domElement.style.cursor = id ? 'pointer' : ''
    this.callbacks.hover(id)
    this.requestRender()
  }

  private onPointerMove = (event: PointerEvent) => {
    if (event.buttons || event.pointerType === 'touch')
      return

    this.hoverPending = { x: event.clientX, y: event.clientY }

    if (this.hoverRaf)
      return

    this.hoverRaf = requestAnimationFrame(() => {
      this.hoverRaf = 0

      const pending = this.hoverPending

      if (!pending || this.disposed)
        return

      const rect = this.renderer.domElement.getBoundingClientRect()

      this.pointer.set(((pending.x - rect.left) / rect.width) * 2 - 1, -((pending.y - rect.top) / rect.height) * 2 + 1)
      this.setHover(this.pick())
    })
  }

  private onPointerLeave = () => {
    this.hoverPending = null
    this.setHover(null)
  }

  private onPointerDown = (event: PointerEvent) => {
    this.down = { x: event.clientX, y: event.clientY, t: performance.now() }
  }

  private onPointerUp = (event: PointerEvent) => {
    const down = this.down

    this.down = null

    if (!down || event.button !== 0)
      return

    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)

    if (moved > 6 || performance.now() - down.t > 700)
      return

    this.ndc(event)

    const id = this.pick()

    if (id)
      this.callbacks.select(id)
  }

  // ---- fin de vie

  dispose() {
    if (this.disposed)
      return

    this.disposed = true
    cancelAnimationFrame(this.raf)
    cancelAnimationFrame(this.hoverRaf)
    this.observer.disconnect()

    const canvas = this.renderer.domElement

    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerleave', this.onPointerLeave)
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    this.controls.removeEventListener('start', this.onStart)
    this.controls.removeEventListener('end', this.onEnd)
    this.controls.removeEventListener('change', this.requestRender)
    this.controls.dispose()
    this.build?.dispose()
    this.build = null

    if (this.ground) {
      this.ground.geometry.dispose();
      (this.ground.material as THREE.Material).dispose()
      this.groundTexture?.dispose()
    }

    this.sun.shadow.map?.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    canvas.remove()
  }
}
