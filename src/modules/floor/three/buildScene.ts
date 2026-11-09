/**
 * Construction de la scène three : niveaux (dalle, murs vitrés, zones, tables, chaises, étiquettes).
 * Ne dépend ni de Vue ni du DOM de la page : `buildScene` renvoie un objet pilotable (états,
 * sélection, survol, niveau mis en avant) et `dispose()` libère tout ce qui a été créé.
 */
import * as THREE from 'three'
// eslint-disable-next-line import/extensions -- le paquet three n'expose ces modules qu'avec l'extension
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LEVEL_D, LEVEL_W, SLAB_T, STATE_COLORS, TABLE_H, WALL_H, chairPlacements, levelElevation, pctToMeters, seatsNote, tableSize, visibleLevels, zoneRect } from './geometry'
import type { ChairPlacement } from './geometry'
import type { Scene3DLevel, Scene3DTable, Scene3DZone, ViewMode } from './sceneTypes'

export interface BuildOptions {
  dark: boolean
  mode: ViewMode
  levelId: string | null
}

/** Suivi de tout ce qui doit être libéré : géométries, matériaux, textures. */
class Registry {
  geometries = new Set<THREE.BufferGeometry>()
  materials = new Set<THREE.Material>()
  textures = new Set<THREE.Texture>()
  instanced = new Set<THREE.InstancedMesh>()

  geo<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.add(geometry)

    return geometry
  }

  mat<T extends THREE.Material>(material: T): T {
    this.materials.add(material)

    return material
  }

  tex<T extends THREE.Texture>(texture: T): T {
    this.textures.add(texture)

    return texture
  }

  disposeAll() {
    this.instanced.forEach(mesh => mesh.dispose())
    this.geometries.forEach(geometry => geometry.dispose())
    this.materials.forEach(material => material.dispose())
    this.textures.forEach(texture => texture.dispose())
    this.instanced.clear()
    this.geometries.clear()
    this.materials.clear()
    this.textures.clear()
  }
}

interface FadeMaterial {
  material: THREE.Material
  opacity: number
  transparent: boolean
}

interface LabelSprite {
  sprite: THREE.Sprite
  canvas: HTMLCanvasElement
  texture: THREE.CanvasTexture
  key: string
}

interface TableRef {
  table: Scene3DTable
  levelIndex: number
  x: number
  z: number
  w: number
  d: number
  rotY: number
  placements: ChairPlacement[]
  top: THREE.InstancedMesh
  topIndex: number
  label: LabelSprite
}

export interface LevelHandle {
  id: string
  index: number
  group: THREE.Group
  refs: TableRef[]
  fades: FadeMaterial[]
  sprites: { sprite: THREE.Sprite; opacity: number }[]
  meshes: THREE.InstancedMesh[]
  chairsTaken: THREE.InstancedMesh | null
  chairsFree: THREE.InstancedMesh | null
  dimmed: boolean
}

export interface SceneBuild {
  root: THREE.Group
  levels: LevelHandle[]

  /** Met à jour états et couverts sans rebâtir. */
  applyStates: (levels: readonly Scene3DLevel[]) => void
  setSelected: (id: string | null) => void
  setHover: (id: string | null) => void

  /** Niveau mis en avant (mode immeuble) : les autres s'estompent, ceux du dessus s'écartent. */
  setFocus: (levelId: string | null) => void

  /** Mailles « touchables » : celles des niveaux non estompés. */
  pickables: () => THREE.InstancedMesh[]

  /** Identifiant de table derrière une instance touchée. */
  tableIdAt: (mesh: THREE.InstancedMesh, instanceId: number) => string | null

  /** Libère géométries, matériaux et textures. */
  dispose: () => void
}

/** Niveaux estompés (immeuble) : ceux du dessus presque transparents pour ne pas cacher le niveau choisi. */
const DIM_BELOW = 0.4
const DIM_ABOVE = 0.14

const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`

// Étiquettes -----------------------------------------------------------------------------

function newCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')

  canvas.width = width
  canvas.height = height

  return canvas
}

function drawTableLabel(canvas: HTMLCanvasElement, numero: string, note: string, color: number, dark: boolean) {
  const ctx = canvas.getContext('2d')

  if (!ctx)
    return

  const { width, height } = canvas

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = dark ? 'rgba(22,24,31,0.94)' : 'rgba(255,255,255,0.95)'
  ctx.strokeStyle = hex(color)
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.roundRect(8, 8, width - 16, height - 16, 30)
  ctx.fill()
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = dark ? '#ffffff' : '#1c1e26'

  let size = note ? 54 : 66

  ctx.font = `700 ${size}px Inter, Segoe UI, sans-serif`

  while (ctx.measureText(numero).width > width - 56 && size > 24) {
    size -= 4
    ctx.font = `700 ${size}px Inter, Segoe UI, sans-serif`
  }

  ctx.fillText(numero, width / 2, note ? height * 0.38 : height / 2 + 2)

  if (note) {
    ctx.font = '700 40px Inter, Segoe UI, sans-serif'
    ctx.fillStyle = hex(color)
    ctx.fillText(note, width / 2, height * 0.74)
  }
}

function drawPill(canvas: HTMLCanvasElement, text: string, dark: boolean, strong: boolean) {
  const ctx = canvas.getContext('2d')

  if (!ctx)
    return

  const { width, height } = canvas

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = dark ? 'rgba(22,24,31,0.82)' : 'rgba(255,255,255,0.88)'
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.roundRect(4, 4, width - 8, height - 8, height / 2 - 4)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = dark ? '#f1f1f5' : '#2b2d36'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  let size = strong ? 58 : 44

  ctx.font = `700 ${size}px Inter, Segoe UI, sans-serif`

  while (ctx.measureText(text).width > width - 60 && size > 20) {
    size -= 3
    ctx.font = `700 ${size}px Inter, Segoe UI, sans-serif`
  }

  ctx.fillText(text.toUpperCase(), width / 2, height / 2 + 2)
}

// Matières et décors -------------------------------------------------------------------------

interface Palette {
  slab: number
  glass: number
  rail: number
  zone: Record<Scene3DZone['type'], { color: number; line: number }>
}

const DARK_PALETTE: Palette = {
  slab: 0x3A3E48,
  glass: 0x9CB8D6,
  rail: 0x80869A,
  zone: {
    salle: { color: 0x8A6A45, line: 0x6F5436 },
    terrasse: { color: 0x9C9178, line: 0x7E745E },
    bar: { color: 0x4A3E36, line: 0x3A312B },
    vip: { color: 0x3C3150, line: 0x2F2640 },
    autre: { color: 0x5A5F69, line: 0x4A4E57 },
  },
}

const LIGHT_PALETTE: Palette = {
  slab: 0xE9ECF1,
  glass: 0xBFD9F2,
  rail: 0xB5BCC8,
  zone: {
    salle: { color: 0xCFA672, line: 0xB68E5B },
    terrasse: { color: 0xE0D2B4, line: 0xC8B896 },
    bar: { color: 0x6F5B4B, line: 0x5A4939 },
    vip: { color: 0x5B4A6E, line: 0x4A3B5C },
    autre: { color: 0xC9CDD3, line: 0xB3B8C0 },
  },
}

const PALETTE = (dark: boolean): Palette => (dark ? DARK_PALETTE : LIGHT_PALETTE)

/** Lames de parquet / de deck : un petit canevas répété sur la zone. */
function plankTexture(reg: Registry, color: number, line: number, w: number, d: number) {
  const canvas = newCanvas(128, 128)
  const ctx = canvas.getContext('2d')

  if (ctx) {
    ctx.fillStyle = hex(color)
    ctx.fillRect(0, 0, 128, 128)
    ctx.fillStyle = hex(line)

    for (let i = 0; i < 128; i += 32)
      ctx.fillRect(0, i, 128, 3)

    for (let row = 0; row < 4; row++)
      ctx.fillRect(((row * 53) % 128), row * 32, 3, 32)
  }

  const texture = reg.tex(new THREE.CanvasTexture(canvas))

  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(Math.max(1, w / 2.4), Math.max(1, d / 2.4))

  return texture
}

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const geometry = new THREE.BoxGeometry(w, h, d)

  geometry.translate(x, y, z)

  return geometry
}

function cylinder(rTop: number, rBottom: number, h: number, x: number, y: number, z: number, segments = 14) {
  const geometry = new THREE.CylinderGeometry(rTop, rBottom, h, segments)

  geometry.translate(x, y, z)

  return geometry
}

function chairGeometry(reg: Registry) {
  const parts = [
    box(0.42, 0.05, 0.42, 0, 0.46, 0),
    box(0.42, 0.4, 0.05, 0, 0.7, -0.19),
    box(0.04, 0.44, 0.04, -0.17, 0.22, 0.17),
    box(0.04, 0.44, 0.04, 0.17, 0.22, 0.17),
    box(0.04, 0.44, 0.04, -0.17, 0.22, -0.17),
    box(0.04, 0.44, 0.04, 0.17, 0.22, -0.17),
  ]

  const merged = mergeGeometries(parts, false)

  parts.forEach(part => part.dispose())

  return reg.geo(merged)
}

// Construction ---------------------------------------------------------------------------------

export function buildScene(allLevels: readonly Scene3DLevel[], options: BuildOptions): SceneBuild {
  const reg = new Registry()
  const palette = PALETTE(options.dark)
  const root = new THREE.Group()
  const levels = visibleLevels(allLevels, options.mode, options.levelId)
  const handles: LevelHandle[] = []
  const tableById = new Map<string, TableRef>()
  const handleOf = new Map<string, LevelHandle>()

  const dummy = new THREE.Object3D()
  const tmpMatrix = new THREE.Matrix4()
  const tmpLocal = new THREE.Matrix4()
  const tmpColor = new THREE.Color()

  // Géométries partagées entre niveaux.
  const roundGeo = reg.geo(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 40))
  const boxTopGeo = reg.geo(new THREE.BoxGeometry(1, 0.06, 1))
  const pedestalGeo = reg.geo(cylinder(0.06, 0.1, TABLE_H - 0.06, 0, (TABLE_H - 0.06) / 2, 0, 12))
  const chairGeo = chairGeometry(reg)
  const ringGeo = reg.geo(new THREE.RingGeometry(0.92, 1, 64))

  ringGeo.rotateX(-Math.PI / 2)

  function levelMaterial<T extends THREE.Material>(handle: LevelHandle, material: T, opacity = 1, transparent = false): T {
    reg.mat(material)
    handle.fades.push({ material, opacity, transparent })

    return material
  }

  function addMesh(handle: LevelHandle, geometry: THREE.BufferGeometry, material: THREE.Material, opts: { cast?: boolean; receive?: boolean } = {}) {
    const mesh = new THREE.Mesh(geometry, material)

    mesh.castShadow = opts.cast ?? false
    mesh.receiveShadow = opts.receive ?? false
    handle.group.add(mesh)

    return mesh
  }

  function addSprite(handle: LevelHandle, canvas: HTMLCanvasElement, width: number, height: number, opacity = 1) {
    const texture = reg.tex(new THREE.CanvasTexture(canvas))

    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4

    const material = reg.mat(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity, depthWrite: false }))
    const sprite = new THREE.Sprite(material)

    sprite.scale.set(width, height, 1)
    handle.group.add(sprite)
    handle.sprites.push({ sprite, opacity })

    return { sprite, texture }
  }

  // ---- une dalle, ses murs, ses zones

  function buildShell(handle: LevelHandle, level: Scene3DLevel) {
    const slabMat = levelMaterial(handle, new THREE.MeshStandardMaterial({ color: palette.slab, roughness: 0.9 }))
    const slab = addMesh(handle, reg.geo(new THREE.BoxGeometry(LEVEL_W, SLAB_T, LEVEL_D)), slabMat, { receive: true })

    slab.position.y = -SLAB_T / 2

    const glassMat = levelMaterial(handle, new THREE.MeshPhysicalMaterial({ color: palette.glass, roughness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }), 0.16, true)
    const railMat = levelMaterial(handle, new THREE.MeshStandardMaterial({ color: palette.rail, roughness: 0.5 }))
    const t = 0.08

    const walls = [
      box(LEVEL_W, WALL_H, t, 0, WALL_H / 2, -LEVEL_D / 2 + t / 2),
      box(LEVEL_W, WALL_H, t, 0, WALL_H / 2, LEVEL_D / 2 - t / 2),
      box(t, WALL_H, LEVEL_D, -LEVEL_W / 2 + t / 2, WALL_H / 2, 0),
      box(t, WALL_H, LEVEL_D, LEVEL_W / 2 - t / 2, WALL_H / 2, 0),
    ]

    const wallGeo = reg.geo(mergeGeometries(walls, false))

    const copings = [
      box(LEVEL_W, 0.07, 0.14, 0, WALL_H, -LEVEL_D / 2 + t / 2),
      box(LEVEL_W, 0.07, 0.14, 0, WALL_H, LEVEL_D / 2 - t / 2),
      box(0.14, 0.07, LEVEL_D, -LEVEL_W / 2 + t / 2, WALL_H, 0),
      box(0.14, 0.07, LEVEL_D, LEVEL_W / 2 - t / 2, WALL_H, 0),
    ]

    const copingGeo = reg.geo(mergeGeometries(copings, false))

    walls.forEach(part => part.dispose())
    copings.forEach(part => part.dispose())
    addMesh(handle, wallGeo, glassMat)
    addMesh(handle, copingGeo, railMat)

    for (const zone of level.zones)
      buildZone(handle, zone)
  }

  function buildZone(handle: LevelHandle, zone: Scene3DZone) {
    const r = zoneRect(zone)

    if (r.w < 0.5 || r.d < 0.5)
      return

    const look = palette.zone[zone.type] ?? palette.zone.autre
    const textured = zone.type === 'salle' || zone.type === 'terrasse'

    const material = levelMaterial(handle, new THREE.MeshStandardMaterial({
      color: textured ? 0xFFFFFF : look.color,
      map: textured ? plankTexture(reg, look.color, look.line, r.w, r.d) : null,
      roughness: 0.85,
    }))

    const plate = addMesh(handle, reg.geo(new THREE.BoxGeometry(r.w, 0.05, r.d)), material, { receive: true })

    plate.position.set(r.cx, 0.025, r.cz)

    if (zone.type === 'terrasse')
      buildTerrace(handle, r)

    if (zone.type === 'bar')
      buildBar(handle, r)

    // Étiquette flottante discrète, au fond de la zone.
    const canvas = newCanvas(512, 128)

    drawPill(canvas, zone.name, options.dark, false)

    const width = Math.min(Math.max(zone.name.length * 0.42 + 1.6, 3.8), Math.max(r.w - 0.6, 3.8))
    const { sprite } = addSprite(handle, canvas, width, width / 4, 0.9)

    sprite.position.set(r.cx - r.w / 2 + width / 2 + 0.4, 1.9, r.cz - r.d / 2 + 0.6)
  }

  function onBoundary(value: number, limit: number) {
    return Math.abs(Math.abs(value) - limit) < 0.35
  }

  function buildTerrace(handle: LevelHandle, r: { cx: number; cz: number; w: number; d: number }) {
    const railMat = levelMaterial(handle, new THREE.MeshStandardMaterial({ color: options.dark ? 0xB9BFCC : 0x8A9099, roughness: 0.4, metalness: 0.4 }))
    const potMat = levelMaterial(handle, new THREE.MeshStandardMaterial({ color: 0x7A5C45, roughness: 0.9 }))
    const leafMat = levelMaterial(handle, new THREE.MeshStandardMaterial({ color: 0x3E8E4D, roughness: 0.9 }))
    const posts: THREE.BufferGeometry[] = []
    const x1 = r.cx - r.w / 2
    const x2 = r.cx + r.w / 2
    const z1 = r.cz - r.d / 2
    const z2 = r.cz + r.d / 2

    const sides = [
      { open: !onBoundary(z1, LEVEL_D / 2), a: [x1, z1], b: [x2, z1] },
      { open: !onBoundary(z2, LEVEL_D / 2), a: [x1, z2], b: [x2, z2] },
      { open: !onBoundary(x1, LEVEL_W / 2), a: [x1, z1], b: [x1, z2] },
      { open: !onBoundary(x2, LEVEL_W / 2), a: [x2, z1], b: [x2, z2] },
    ]

    for (const side of sides) {
      if (!side.open)
        continue

      const [ax, az] = side.a
      const [bx, bz] = side.b
      const length = Math.hypot(bx - ax, bz - az)
      const n = Math.max(1, Math.round(length / 1.2))

      for (let i = 0; i <= n; i++) {
        const k = i / n

        posts.push(box(0.06, 0.95, 0.06, ax + (bx - ax) * k, 0.5, az + (bz - az) * k))
      }

      const horizontal = Math.abs(bx - ax) > Math.abs(bz - az)

      for (const y of [0.55, 0.98])
        posts.push(horizontal ? box(length, 0.04, 0.05, (ax + bx) / 2, y, az) : box(0.05, 0.04, length, ax, y, (az + bz) / 2))
    }

    if (posts.length) {
      const railGeo = reg.geo(mergeGeometries(posts, false))

      posts.forEach(part => part.dispose())
      addMesh(handle, railGeo, railMat, { cast: true })
    }

    // Jardinières aux angles.
    const pots: THREE.BufferGeometry[] = []
    const leaves: THREE.BufferGeometry[] = []

    for (const [px, pz] of [[x1 + 0.6, z1 + 0.6], [x2 - 0.6, z1 + 0.6], [x1 + 0.6, z2 - 0.6], [x2 - 0.6, z2 - 0.6]]) {
      pots.push(box(0.7, 0.5, 0.7, px, 0.3, pz))

      const leaf = new THREE.SphereGeometry(0.46, 14, 10)

      leaf.translate(px, 0.95, pz)
      leaves.push(leaf)
    }

    const potGeo = reg.geo(mergeGeometries(pots, false))
    const leafGeo = reg.geo(mergeGeometries(leaves, false))

    pots.forEach(part => part.dispose())
    leaves.forEach(part => part.dispose())
    addMesh(handle, potGeo, potMat, { cast: true })
    addMesh(handle, leafGeo, leafMat, { cast: true })
  }

  function buildBar(handle: LevelHandle, r: { cx: number; cz: number; w: number; d: number }) {
    const woodMat = levelMaterial(handle, new THREE.MeshStandardMaterial({ color: options.dark ? 0x7A5A3C : 0x8A6A4A, roughness: 0.7 }))
    const topMat = levelMaterial(handle, new THREE.MeshStandardMaterial({ color: options.dark ? 0xC8B08C : 0xE3CFAE, roughness: 0.4 }))
    const stoolMat = levelMaterial(handle, new THREE.MeshStandardMaterial({ color: options.dark ? 0x2B2F3A : 0x3A3F4C, roughness: 0.6 }))
    const x2 = r.cx + r.w / 2
    const z2 = r.cz + r.d / 2

    // Comptoir en L : le long du bord bas (z+) et du bord droit (x+) de la zone.
    const lenX = Math.max(1.5, r.w - 1.6)
    const lenZ = Math.max(1.5, r.d - 1.6)

    const bodies = [
      box(lenX, 1.0, 0.62, r.cx - 0.2, 0.55, z2 - 0.5),
      box(0.62, 1.0, lenZ, x2 - 0.5, 0.55, r.cz - 0.2),
    ]

    const tops = [
      box(lenX + 0.1, 0.05, 0.78, r.cx - 0.2, 1.08, z2 - 0.5),
      box(0.78, 0.05, lenZ + 0.1, x2 - 0.5, 1.08, r.cz - 0.2),
    ]

    const stools: THREE.BufferGeometry[] = []

    for (let k = 0.7; k < lenX - 0.3; k += 0.9)
      stools.push(cylinder(0.19, 0.19, 0.06, r.cx - 0.2 - lenX / 2 + k, 0.7, z2 - 1.35, 16), cylinder(0.035, 0.035, 0.7, r.cx - 0.2 - lenX / 2 + k, 0.35, z2 - 1.35, 8))

    for (let k = 0.7; k < lenZ - 0.3; k += 0.9)
      stools.push(cylinder(0.19, 0.19, 0.06, x2 - 1.35, 0.7, r.cz - 0.2 - lenZ / 2 + k, 16), cylinder(0.035, 0.035, 0.7, x2 - 1.35, 0.35, r.cz - 0.2 - lenZ / 2 + k, 8))

    const bodyGeo = reg.geo(mergeGeometries(bodies, false))
    const topGeo = reg.geo(mergeGeometries(tops, false))

    bodies.forEach(part => part.dispose())
    tops.forEach(part => part.dispose())
    addMesh(handle, bodyGeo, woodMat, { cast: true })
    addMesh(handle, topGeo, topMat, { cast: true })

    if (stools.length) {
      const stoolGeo = reg.geo(mergeGeometries(stools, false))

      stools.forEach(part => part.dispose())
      addMesh(handle, stoolGeo, stoolMat, { cast: true })
    }
  }

  // ---- tables et chaises d'un niveau

  function instanced(handle: LevelHandle, geometry: THREE.BufferGeometry, material: THREE.Material, count: number) {
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(count, 1))

    mesh.count = count
    mesh.castShadow = true
    mesh.receiveShadow = true
    handle.group.add(mesh)
    handle.meshes.push(mesh)
    reg.instanced.add(mesh)

    return mesh
  }

  function buildTables(handle: LevelHandle, level: Scene3DLevel) {
    const tables = level.tables
    const topMat = levelMaterial(handle, new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.5 }))
    const pedestalMat = levelMaterial(handle, new THREE.MeshStandardMaterial({ color: options.dark ? 0x4B5060 : 0x6A7080, roughness: 0.5, metalness: 0.3 }))
    const rounds = tables.filter(t => t.shape === 'round')
    const boxes = tables.filter(t => t.shape !== 'round')
    const topsRound = rounds.length ? instanced(handle, roundGeo, topMat, rounds.length) : null
    const topsBox = boxes.length ? instanced(handle, boxTopGeo, topMat, boxes.length) : null
    const pedestals = tables.length ? instanced(handle, pedestalGeo, pedestalMat, tables.length + boxes.length) : null
    let pedestalIndex = 0

    if (topsRound)
      topsRound.userData.ids = rounds.map(t => t.id)

    if (topsBox)
      topsBox.userData.ids = boxes.map(t => t.id)

    const counters = { round: 0, box: 0 }

    for (const table of tables) {
      const size = tableSize(table.shape, table.capacity)
      const pos = pctToMeters(table.x, table.y)
      const top = table.shape === 'round' ? topsRound! : topsBox!
      const topIndex = table.shape === 'round' ? counters.round++ : counters.box++
      const rotY = THREE.MathUtils.degToRad(table.rot ?? 0)

      // Étiquette : numéro et, si la table est occupée, ses places libres.
      const canvas = newCanvas(256, 128)
      const note = seatsNote(table)

      drawTableLabel(canvas, table.numero, note, STATE_COLORS[table.state], options.dark)

      const { sprite, texture } = addSprite(handle, canvas, 2.1, 1.05)

      sprite.position.set(pos.x, TABLE_H + 1.25, pos.z)

      const ref: TableRef = {
        table: { ...table },
        levelIndex: handle.index,
        x: pos.x,
        z: pos.z,
        w: size.w,
        d: size.d,
        rotY,
        placements: chairPlacements(table.shape, table.capacity),
        top,
        topIndex,
        label: { sprite, canvas, texture, key: `${table.state}|${note}` },
      }

      handle.refs.push(ref)
      tableById.set(table.id, ref)
      handleOf.set(table.id, handle)

      // Pied(s) : un seul, deux pour une longue table rectangulaire.
      const feet = table.shape === 'rect' ? [-size.w / 3, size.w / 3] : [0]

      for (const dx of feet) {
        dummy.position.set(pos.x + Math.cos(rotY) * dx, 0, pos.z - Math.sin(rotY) * dx)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        pedestals!.setMatrixAt(pedestalIndex++, dummy.matrix)
      }

      paintTable(ref, false, false)
    }

    if (pedestals)
      pedestals.count = pedestalIndex

    // Chaises : prises (couleur de l'état) et libres (grises, translucides), deux maillages.
    const total = tables.reduce((sum, t) => sum + Math.min(Math.max(Math.round(t.capacity), 1), 12), 0)

    if (total) {
      const takenMat = levelMaterial(handle, new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.6 }))
      const freeMat = levelMaterial(handle, new THREE.MeshStandardMaterial({ color: options.dark ? 0xAEB4C2 : 0xC9CED8, roughness: 0.7, transparent: true, opacity: 0.42, depthWrite: false }), 0.42, true)

      handle.chairsTaken = instanced(handle, chairGeo, takenMat, total)
      handle.chairsFree = instanced(handle, chairGeo, freeMat, total)
      handle.chairsFree.castShadow = false
      layoutChairs(handle)
    }

    for (const mesh of handle.meshes)
      mesh.computeBoundingSphere()
  }

  /** Place les chaises : les premières (selon `taken`) sont « prises », les autres libres. */
  function layoutChairs(handle: LevelHandle) {
    const taken = handle.chairsTaken
    const free = handle.chairsFree

    if (!taken || !free)
      return

    const takenIds: string[] = []
    const freeIds: string[] = []
    let nt = 0
    let nf = 0

    for (const ref of handle.refs) {
      tmpMatrix.makeRotationY(ref.rotY)
      tmpMatrix.setPosition(ref.x, 0, ref.z)

      ref.placements.forEach((chair, i) => {
        tmpLocal.makeRotationY(chair.ry)
        tmpLocal.setPosition(chair.x, 0, chair.z)
        dummy.matrix.multiplyMatrices(tmpMatrix, tmpLocal)

        const seated = i < ref.table.taken && (ref.table.state === 'busy' || ref.table.state === 'paying')

        if (seated) {
          taken.setMatrixAt(nt, dummy.matrix)
          taken.setColorAt(nt, tmpColor.setHex(STATE_COLORS[ref.table.state]))
          takenIds.push(ref.table.id)
          nt++
        }
        else {
          free.setMatrixAt(nf, dummy.matrix)
          freeIds.push(ref.table.id)
          nf++
        }
      })
    }

    taken.count = nt
    free.count = nf
    taken.userData.ids = takenIds
    free.userData.ids = freeIds

    for (const mesh of [taken, free]) {
      mesh.instanceMatrix.needsUpdate = true

      if (mesh.instanceColor)
        mesh.instanceColor.needsUpdate = true

      mesh.boundingSphere = null
      mesh.boundingBox = null
    }
  }

  // ---- sélection et survol

  let selectedId: string | null = null
  let hoverId: string | null = null
  const ringMat = reg.mat(new THREE.MeshBasicMaterial({ color: options.dark ? 0xFFD9B0 : 0xE67E22, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }))
  const hoverMat = reg.mat(new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }))
  const selectedRing = new THREE.Mesh(ringGeo, ringMat)
  const hoverRing = new THREE.Mesh(ringGeo, hoverMat)

  selectedRing.visible = false
  hoverRing.visible = false
  selectedRing.renderOrder = 2
  hoverRing.renderOrder = 2

  function paintTable(ref: TableRef, hovered: boolean, selected: boolean) {
    tmpColor.setHex(STATE_COLORS[ref.table.state])

    if (hovered)
      tmpColor.lerp(new THREE.Color(0xFFFFFF), 0.3)

    ref.top.setColorAt(ref.topIndex, tmpColor)

    const lift = selected ? 0.07 : 0

    dummy.position.set(ref.x, TABLE_H - 0.03 + lift, ref.z)
    dummy.rotation.set(0, ref.table.shape === 'round' ? 0 : ref.rotY, 0)
    dummy.scale.set(ref.w, 1, ref.d)
    dummy.updateMatrix()
    ref.top.setMatrixAt(ref.topIndex, dummy.matrix)
    ref.top.instanceMatrix.needsUpdate = true

    if (ref.top.instanceColor)
      ref.top.instanceColor.needsUpdate = true
  }

  function placeRing(ring: THREE.Mesh, id: string | null) {
    const ref = id ? tableById.get(id) : null
    const handle = id ? handleOf.get(id) : null

    ring.visible = !!ref && !!handle

    if (!ref || !handle)
      return

    if (ring.parent !== handle.group)
      handle.group.add(ring)

    const radius = Math.max(ref.w, ref.d) / 2 + 0.78

    ring.position.set(ref.x, 0.06, ref.z)
    ring.scale.setScalar(radius)
  }

  function refresh(id: string | null) {
    const ref = id ? tableById.get(id) : null

    if (ref)
      paintTable(ref, ref.table.id === hoverId, ref.table.id === selectedId)
  }

  // ---- niveaux

  levels.forEach((level, index) => {
    const handle: LevelHandle = {
      id: level.id,
      index,
      group: new THREE.Group(),
      refs: [],
      fades: [],
      sprites: [],
      meshes: [],
      chairsTaken: null,
      chairsFree: null,
      dimmed: false,
    }

    handles.push(handle)
    root.add(handle.group)
    buildShell(handle, level)
    buildTables(handle, level)

    if (options.mode === 'building') {
      const canvas = newCanvas(512, 128)

      drawPill(canvas, level.name, options.dark, true)

      const { sprite } = addSprite(handle, canvas, 4.6, 1.15, 0.95)

      sprite.position.set(-LEVEL_W / 2 + 2.6, 0.3, LEVEL_D / 2 + 1.2)
    }
  })

  function setFocus(levelId: string | null) {
    const focusIndex = options.mode === 'building' ? handles.findIndex(handle => handle.id === levelId) : -1

    handles.forEach((handle, index) => {
      handle.group.position.y = levelElevation(index, focusIndex >= 0 ? focusIndex : null)

      const dim = focusIndex >= 0 && index !== focusIndex
      const factor = dim ? (index > focusIndex ? DIM_ABOVE : DIM_BELOW) : 1

      handle.dimmed = dim

      for (const fade of handle.fades) {
        fade.material.opacity = fade.opacity * factor
        fade.material.transparent = fade.transparent || dim
        fade.material.needsUpdate = true
      }

      for (const item of handle.sprites)
        item.sprite.material.opacity = item.opacity * (dim ? Math.min(0.5, factor * 1.5) : 1)
    })
  }

  setFocus(options.levelId)

  return {
    root,
    levels: handles,
    setFocus,

    applyStates(next) {
      for (const level of next) {
        const handle = handles.find(item => item.id === level.id)

        if (!handle)
          continue

        for (const table of level.tables) {
          const ref = tableById.get(table.id)

          if (!ref)
            continue

          ref.table.state = table.state
          ref.table.taken = table.taken
          paintTable(ref, ref.table.id === hoverId, ref.table.id === selectedId)

          const note = seatsNote(table)
          const key = `${table.state}|${note}`

          if (key !== ref.label.key) {
            drawTableLabel(ref.label.canvas, table.numero, note, STATE_COLORS[table.state], options.dark)
            ref.label.texture.needsUpdate = true
            ref.label.key = key
          }
        }

        layoutChairs(handle)
      }
    },

    setSelected(id) {
      const previous = selectedId

      selectedId = id && tableById.has(id) ? id : null
      refresh(previous)
      refresh(selectedId)
      placeRing(selectedRing, selectedId)
    },

    setHover(id) {
      const previous = hoverId

      hoverId = id && tableById.has(id) ? id : null
      refresh(previous)
      refresh(hoverId)
      placeRing(hoverRing, hoverId === selectedId ? null : hoverId)
    },

    pickables: () => handles.filter(handle => !handle.dimmed).flatMap(handle => handle.meshes),

    tableIdAt(mesh, instanceId) {
      const ids = mesh.userData.ids as string[] | undefined

      return ids?.[instanceId] ?? null
    },

    dispose() {
      selectedRing.removeFromParent()
      hoverRing.removeFromParent()
      root.removeFromParent()
      root.clear()
      reg.disposeAll()
    },
  }
}

/** Nombre de tables et de niveaux, pour l'étiquette d'accessibilité. */
export function describeScene(levels: readonly Scene3DLevel[], mode: ViewMode, levelId: string | null): string {
  const shown = visibleLevels(levels, mode, levelId)
  const tables = shown.reduce((sum, level) => sum + level.tables.length, 0)
  const free = shown.reduce((sum, level) => sum + level.tables.filter(t => t.state === 'free').length, 0)

  if (mode === 'building')
    return `Vue 3D de l'immeuble : ${levels.length} niveau${levels.length > 1 ? 'x' : ''}, ${tables} table${tables > 1 ? 's' : ''}, dont ${free} libre${free > 1 ? 's' : ''}.`

  return `Vue 3D du niveau ${shown[0]?.name ?? ''} : ${tables} table${tables > 1 ? 's' : ''}, dont ${free} libre${free > 1 ? 's' : ''}.`
}
