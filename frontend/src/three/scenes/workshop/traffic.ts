/**
 * Controlador de tráfico de las maquetas (taller y garaje): decide quién se mueve cuando cambian los datos, planifica
 * las salidas sin choques (`motion.ts`) y lleva el reloj con GSAP. No toca React: recibe los objetos de three de cada
 * coche (`CarHandle`) y los de los carros de los elevadores, y pide fotogramas con `redraw`.
 *
 *  - Un coche solo se mueve si cambia su plaza o su altura (estado real de la orden) o si acaba de aparecer (entra por
 *    la entrada). Los coches nuevos esperan ocultos hasta que les toca salir.
 *  - Un único tween de GSAP (`ease: 'none'`) avanza un reloj de 0 al final del plan; en cada paso se evalúa `poseAt`
 *    de cada coche, que es la misma función que simula el planificador. Se limpia con `gsap.context`.
 *  - Si llegan cambios mientras hay coches en marcha, se encolan: se planifican desde el reposo al terminar (así no se
 *    replanifica a medio trayecto y no hay saltos ni choques).
 *  - Con movimiento reducido (o antes de que la escena esté compilada) no hay trayectos: posición final directa.
 */
import gsap from 'gsap'
import type * as THREE from 'three'
import { newPoseOut, orderMovers, planTraffic, poseAt, type Box, type CarDims, type Mover, type Plan, type Pose, type PoseOut, type Route } from './motion'

export interface Desired {
  id: number
  dims: CarDims
  /** Clave de la plaza de destino. */
  key: string
  /** Pose final (centro, rumbo y altura). */
  pose: Pose
  /** Elevador cuyo carro sube con el coche (o null). */
  bay: number | null
}

/** Objetos de un coche: `root` lleva posición en planta, rumbo y escala; `lift` lleva la altura. */
export interface CarHandle {
  root: THREE.Object3D
  lift: THREE.Object3D
}

export interface TrafficWorld {
  /** Pose de aparición de un coche que entra (ya en el carril de su destino). */
  entrance: (to: Desired) => Pose
  obstacles: Box[]
  /** Ruta de una plaza (o de 'entrance') a otra; null si no hace falta moverse. */
  route: (from: Pose, fromKey: string, to: Desired) => Route | null
}

export interface TrafficOptions {
  reduced: boolean
  /** false hasta que los shaders están compilados: los coches nuevos esperan ocultos. */
  armed: boolean
}

interface CarState {
  key: string
  pose: Pose
  bay: number | null
}

interface Call {
  world: TrafficWorld
  desired: Desired[]
  opts: TrafficOptions
}

export class Traffic {
  private state = new Map<number, CarState>()
  private plans: Plan[] = []
  private attached = new Map<number, number | null>()
  private clock = { t: 0 }
  private tween: gsap.core.Tween | null = null
  private pending: Call | null = null
  private ctx = gsap.context(() => {})
  private out: PoseOut = newPoseOut()

  private handles: Map<number, CarHandle>
  private carriages: Map<number, THREE.Object3D>
  private redraw: () => void

  constructor(handles: Map<number, CarHandle>, carriages: Map<number, THREE.Object3D>, redraw: () => void) {
    this.handles = handles
    this.carriages = carriages
    this.redraw = redraw
  }

  /** true mientras hay coches en marcha. */
  get busy(): boolean {
    return this.tween !== null
  }

  private put(id: number, x: number, z: number, heading: number, y: number, scale: number, visible: boolean) {
    const h = this.handles.get(id)
    if (!h) return
    h.root.position.set(x, 0, z)
    h.root.rotation.y = heading
    h.root.scale.setScalar(scale)
    h.root.visible = visible
    h.lift.position.y = y
  }

  private setCarriage(bay: number | null, y: number) {
    if (bay == null) return
    const c = this.carriages.get(bay)
    if (c) c.position.y = y
  }

  /** Reposo: el coche en su plaza (o oculto si aún no ha entrado). */
  private rest(id: number) {
    const st = this.state.get(id)
    if (!st) return
    const entering = st.key === 'entrance'
    this.put(id, st.pose.x, st.pose.z, st.pose.heading, st.pose.y, 1, !entering)
    if (!entering) this.setCarriage(st.bay, st.pose.y)
  }

  /** Aplica el estado deseado sin animación (movimiento reducido o escena aún no lista para animar). */
  private snap(d: Desired) {
    const prev = this.state.get(d.id)
    if (prev && prev.bay != null && prev.bay !== d.bay) this.setCarriage(prev.bay, 0)
    this.state.set(d.id, { key: d.key, pose: d.pose, bay: d.bay })
    this.rest(d.id)
  }

  private stop() {
    // los planes se vacían antes de revertir: revertir el tween lo pinta una vez en t = 0 (y llamaría a `tick`, que
    // devolvería todos los coches a la entrada)
    this.plans = []
    this.attached.clear()
    this.tween = null
    this.ctx.revert()
  }

  sync(world: TrafficWorld, desired: Desired[], opts: TrafficOptions): void {
    const ids = new Set(desired.map((d) => d.id))
    for (const [id, st] of this.state) {
      if (ids.has(id)) continue
      this.state.delete(id)
      this.setCarriage(st.bay, 0)
      this.plans = this.plans.filter((p) => p.mover.id !== id)
    }

    if (opts.reduced) {
      this.pending = null
      if (this.busy) this.stop()
      for (const d of desired) this.snap(d)
      this.redraw()
      return
    }

    // los coches nuevos aparecen ocultos en la entrada hasta que les toca salir
    for (const d of desired) {
      if (!this.state.has(d.id)) {
        this.state.set(d.id, { key: 'entrance', pose: world.entrance(d), bay: null })
        this.rest(d.id)
      }
    }
    if (!opts.armed || this.busy) {
      if (this.busy) this.pending = { world, desired, opts }
      return
    }
    this.pending = null

    const movers: Mover[] = []
    for (const d of desired) {
      const st = this.state.get(d.id)!
      const entering = st.key === 'entrance'
      if (!entering && st.key === d.key && Math.abs(st.pose.y - d.pose.y) < 0.001) {
        this.rest(d.id)
        continue
      }
      const from = entering ? world.entrance(d) : st.pose
      movers.push({
        id: d.id,
        dims: d.dims,
        from,
        fromKey: st.key,
        entering,
        fromBay: entering ? null : st.bay,
        to: d.pose,
        toKey: d.key,
        toBay: d.bay,
        route: st.key === d.key ? null : world.route(from, st.key, d),
      })
    }
    if (movers.length === 0) {
      this.redraw()
      return
    }
    const moving = new Set(movers.map((m) => m.id))
    const statics = desired
      .filter((d) => !moving.has(d.id))
      .map((d) => ({ id: d.id, dims: d.dims, pose: this.state.get(d.id)!.pose }))
    const plans = planTraffic(orderMovers(movers), statics, world.obstacles)
    const horizon = plans.reduce((e, p) => Math.max(e, p.start + p.total), 0)
    this.plans = plans
    this.clock.t = 0
    this.ctx.add(() => {
      this.tween = gsap.to(this.clock, {
        t: horizon,
        duration: Math.max(0.01, horizon),
        ease: 'none',
        onUpdate: () => this.tick(),
        onComplete: () => this.finish(desired),
      })
    })
    this.tick()
  }

  private tick() {
    const o = this.out
    for (const p of this.plans) {
      poseAt(p, this.clock.t, o)
      const id = p.mover.id
      this.put(id, o.x, o.z, o.heading, o.y, o.scale, o.visible)
      const was = this.attached.get(id) ?? null
      if (was !== null && was !== o.bay) this.setCarriage(was, 0)
      this.attached.set(id, o.bay)
      if (o.bay != null) this.setCarriage(o.bay, o.y)
    }
    this.redraw()
  }

  private finish(desired: Desired[]) {
    const plans = this.plans
    for (const p of plans) {
      const m = p.mover
      const d = desired.find((x) => x.id === m.id)
      if (!this.state.has(m.id)) continue
      this.state.set(m.id, { key: m.toKey, pose: m.to, bay: m.toBay })
      if (d) this.rest(m.id)
    }
    this.stop()
    this.redraw()
    const next = this.pending
    this.pending = null
    if (next) this.sync(next.world, next.desired, next.opts)
  }

  dispose() {
    this.pending = null
    this.stop()
  }
}
