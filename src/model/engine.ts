import { isOpen, nextOpening } from './clock'
import { routes, type PathName } from './routes'

export type Parameters = {
  arrivalMean: number
  orderMean: number
  paymentMean: number
  deliveryMean: number
  speed: number
  seed: number
}
export const DEFAULT_PARAMETERS: Parameters = {
  arrivalMean: 105, orderMean: 185, paymentMean: 39,
  deliveryMean: 14, speed: 20, seed: 20261102,
}

type Phase = 'entry' | 'order1' | 'order2' | 'service1' | 'service2' |
  'toPay1' | 'toPay2' | 'payment' | 'toDelivery' | 'delivery' | 'exit' | 'finished'
type ServerName = 'cit1' | 'cit2' | 'payment' | 'delivery'
const isMoving = (p: Phase): p is PathName =>
  p === 'entry' || p === 'order1' || p === 'order2' || p === 'toPay1' ||
  p === 'toPay2' || p === 'toDelivery' || p === 'exit'

export type Vehicle = {
  id: number; phase: Phase; x: number; z: number; yaw: number
  d: number; arrived: number; startedOrder?: number; finishedOrder?: number
  startedPayment?: number; finishedPayment?: number
  startedDelivery?: number; finishedDelivery?: number; departure?: number
  serviceUntil: number; citophone?: 1 | 2
}
export type Report = {
  seconds: number; totalArrivals: number; exited: number; outsideQueue: number
  initialQueue: number; paymentQueue: number; deliveryQueue: number
  averageSystem: number; averageOrderService: number; averagePaymentService: number; averageDeliveryService: number; averageServiceTotal: number; averageExitTravel: number; averageInitialWait: number; averagePaymentWait: number; averageDeliveryWait: number; maxQueue: number; open: boolean
  servers: { name: string; status: string; utilization: number }[]
  visibleIds: number[]; travelTimeMean: number
}

function makeRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return (state + 0.5) / 4294967296
  }
}

/** Entidades individuales; estaciones y servicios dependen del tiempo del motor.
 * Un vehículo solo sale de una estación al finalizar su servicio. Todas las posiciones
 * utilizan las mismas rutas dibujadas en 3D; no hay teletransportes.
 */
export class AutoMacEngine {
  readonly params: Parameters
  readonly random: () => number
  t = 0
  arrivals = 0
  completed = 0
  private nextArrival = Number.POSITIVE_INFINITY
  private outside: Vehicle[] = []
  private active: Vehicle[] = []
  private all = new Map<number, Vehicle>()
  private orderOwner: [number | null, number | null] = [null, null]
  private paymentOwner: number | null = null
  private deliveryOwner: number | null = null
  private mergeOwner: number | null = null
  private activity: Record<ServerName, number> = { cit1: 0, cit2: 0, payment: 0, delivery: 0 }
  private totalSystem = 0
  // Solo tiempos de servicio de vehiculos que terminaron el recorrido.
  private serviceTotals = { order: 0, payment: 0, delivery: 0 }
  private serviceSamples = { order: 0, payment: 0, delivery: 0 }
  private fullServiceTotal = 0
  private fullServiceSamples = 0
  private exitTravelTotal = 0
  private waitTotals = { initial: 0, payment: 0, delivery: 0 }
  private waitSamples = { initial: 0, payment: 0, delivery: 0 }
  private maxQueue = 0
  readonly minGap = 2.38
  readonly driveSpeed = 2.45

  constructor(p: Parameters) {
    this.params = { ...p }
    this.random = makeRandom(p.seed)
    // El reloj comienza a las 09:58, cuando el local todavía está cerrado.
    // La primera llegada ocurre después de la apertura a las 10:00.
    this.nextArrival = nextOpening(0) + this.sampleArrival()
  }

  getVehicle(id: number) { return this.all.get(id) }
  private sampleArrival() { return Math.max(1.5, -Math.log(1 - this.random()) * this.params.arrivalMean) }
  // Media igual al parámetro; distribución triangular acotada a +-35 %.
  private sampleService(mean: number) { return mean * (0.65 + 0.35 * (this.random() + this.random())) }
  private processArrival() {
    const id = ++this.arrivals
    const at = routes.entry.at(0)
    const car: Vehicle = { id, phase: 'entry', d: 0, x: at.x, z: at.z, yaw: at.yaw,
      arrived: this.t, serviceUntil: 0 }
    this.outside.push(car)
    this.all.set(id, car)
  }
  private canOccupy(x: number, z: number, subjectId: number) {
    for (const v of this.active) {
      if (v.id === subjectId) continue
      const dx = v.x - x, dz = v.z - z
      if (dx * dx + dz * dz < this.minGap * this.minGap) return false
    }
    return true
  }
  private admitOutside() {
    // El vehículo espera fuera del tramo representado si el ingreso está ocupado.
    if (!this.outside.length) return
    const car = this.outside[0]
    if (this.canOccupy(car.x, car.z, car.id)) {
      this.outside.shift(); this.active.push(car)
    }
  }
  private setPhase(v: Vehicle, phase: Phase) {
    v.phase = phase; v.d = 0
    if (isMoving(phase)) {
      const pose = routes[phase].at(0)
      // Los recorridos consecutivos comparten exactamente el mismo extremo.
      v.x = pose.x; v.z = pose.z; v.yaw = pose.yaw
    }
  }
  private atEnd(v: Vehicle) {
    switch (v.phase) {
      case 'entry': {
        const a = this.orderOwner[0] === null, b = this.orderOwner[1] === null
        if (!a && !b) return
        const which: 1 | 2 = a && b ? (this.arrivals % 2 === 0 ? 1 : 2) : a ? 1 : 2
        this.orderOwner[which - 1] = v.id // reserva de aproximación
        v.citophone = which
        this.setPhase(v, which === 1 ? 'order1' : 'order2')
        return
      }
      case 'order1':
      case 'order2': {
        v.startedOrder = this.t
        v.serviceUntil = this.t + this.sampleService(this.params.orderMean)
        v.phase = v.phase === 'order1' ? 'service1' : 'service2'
        return
      }
      case 'toPay1': case 'toPay2': {
        if (this.paymentOwner !== null) return
        this.paymentOwner = v.id
        if (this.mergeOwner === v.id) this.mergeOwner = null
        v.startedPayment = this.t
        v.serviceUntil = this.t + this.sampleService(this.params.paymentMean)
        v.phase = 'payment'
        return
      }
      case 'toDelivery': {
        if (this.deliveryOwner !== null) return
        this.deliveryOwner = v.id
        v.startedDelivery = this.t
        v.serviceUntil = this.t + this.sampleService(this.params.deliveryMean)
        v.phase = 'delivery'
        return
      }
      case 'exit':
        if (this.mergeOwner === v.id) this.mergeOwner = null
        v.phase = 'finished'; v.departure = this.t; this.completed++
        this.totalSystem += this.t - v.arrived
        // Tramo posterior a la atencion de entrega y anterior a abandonar el sistema.
        if (v.finishedDelivery !== undefined) {
          this.exitTravelTotal += Math.max(0, this.t - v.finishedDelivery)
        }
        // Tiempos reales de atencion, sin los recorridos ni las colas.
        if (v.startedOrder !== undefined && v.finishedOrder !== undefined) {
          this.serviceTotals.order += Math.max(0, v.finishedOrder - v.startedOrder)
          this.serviceSamples.order++
        }
        if (v.startedPayment !== undefined && v.finishedPayment !== undefined) {
          this.serviceTotals.payment += Math.max(0, v.finishedPayment - v.startedPayment)
          this.serviceSamples.payment++
        }
        if (v.startedDelivery !== undefined && v.finishedDelivery !== undefined) {
          this.serviceTotals.delivery += Math.max(0, v.finishedDelivery - v.startedDelivery)
          this.serviceSamples.delivery++
        }
        if (v.startedOrder !== undefined && v.finishedOrder !== undefined &&
            v.startedPayment !== undefined && v.finishedPayment !== undefined &&
            v.startedDelivery !== undefined && v.finishedDelivery !== undefined) {
          this.fullServiceTotal += (v.finishedOrder - v.startedOrder) +
            (v.finishedPayment - v.startedPayment) +
            (v.finishedDelivery - v.startedDelivery) +
            (this.t - v.finishedDelivery)
          this.fullServiceSamples++
        }
        // Los promedios se calculan entre vehiculos que finalizaron el recorrido.
        // Incluyen traslados y bloqueos entre etapas, como las columnas del registro.
        if (v.startedOrder !== undefined) {
          this.waitTotals.initial += Math.max(0, v.startedOrder - v.arrived)
          this.waitSamples.initial++
        }
        if (v.finishedOrder !== undefined && v.startedPayment !== undefined) {
          this.waitTotals.payment += Math.max(0, v.startedPayment - v.finishedOrder)
          this.waitSamples.payment++
        }
        if (v.finishedPayment !== undefined && v.startedDelivery !== undefined) {
          this.waitTotals.delivery += Math.max(0, v.startedDelivery - v.finishedPayment)
          this.waitSamples.delivery++
        }
        // Evitar crecimiento indefinido en ejecuciones que abarcan muchas jornadas.
        this.all.delete(v.id)
        return
    }
  }
  private serviceTransitions(dt: number) {
    for (const v of this.active) {
      if (v.phase === 'service1' || v.phase === 'service2') {
        this.activity[v.phase === 'service1' ? 'cit1' : 'cit2'] += dt
        if (this.t >= v.serviceUntil) {
          v.finishedOrder = this.t
          this.orderOwner[(v.citophone ?? 1) - 1] = null
          this.setPhase(v, v.citophone === 1 ? 'toPay1' : 'toPay2')
        }
      } else if (v.phase === 'payment') {
        this.activity.payment += dt
        if (this.t >= v.serviceUntil) {
          v.finishedPayment = this.t
          this.paymentOwner = null
          this.setPhase(v, 'toDelivery')
        }
      } else if (v.phase === 'delivery') {
        this.activity.delivery += dt
        if (this.t >= v.serviceUntil) {
          v.finishedDelivery = this.t
          this.deliveryOwner = null
          this.setPhase(v, 'exit')
        }
      }
    }
  }
  private movementPriority(v: Vehicle) {
    if (v.phase === 'exit') return 0
    if (v.phase === 'toDelivery') return 1
    if (v.phase === 'toPay1' || v.phase === 'toPay2') return 2
    if (v.phase === 'order1' || v.phase === 'order2') return 3
    return 4
  }
  /**
   * Movimiento por distancia de arco, con resolución explícita del último
   * segmento. La llegada a una estación no depende de que una subdivisión
   * del paso supere un umbral de coma flotante.
   */
  private move(dt: number) {
    // Los vehículos delanteros se mueven primero para liberar el espacio
    // necesario a los que vienen detrás.
    const sorted = [...this.active].sort((a, b) =>
      this.movementPriority(a) - this.movementPriority(b) || b.d - a.d)
    for (const v of sorted) {
      if (!isMoving(v.phase)) continue
      const path = routes[v.phase]
      const remaining = Math.max(0, path.length - v.d)
      const atMerge = v.phase === 'toPay1' || v.phase === 'toPay2'

      // Evitar que el cerrojo de la bifurcación quede asociado a un vehículo
      // que ya abandonó el tramo correspondiente.
      if (this.mergeOwner !== null) {
        const owner = this.all.get(this.mergeOwner)
        if (!owner || (owner.phase !== 'toPay1' && owner.phase !== 'toPay2') || owner.x >= 3.65) {
          this.mergeOwner = null
        }
      }

      // Final de ruta. Procesar el evento sin depender de cuánto resta
      // después de sucesivas divisiones del paso de movimiento.
      if (remaining <= 0.0001) {
        this.atEnd(v)
        continue
      }
      const permitted = Math.min(remaining, this.driveSpeed * dt)

      // Verificar todo movimiento, incluido el último paso hasta el destino.
      // Esto evita el atasco cuando restan centésimas de unidad para llegar
      // a la ventanilla o para abandonar la escena.
      const eligible = (distance: number) => {
        const pose = path.at(v.d + distance)
        if (atMerge && v.x < -2.85 && pose.x >= -2.85 &&
            this.mergeOwner !== null && this.mergeOwner !== v.id) return false
        return this.canOccupy(pose.x, pose.z, v.id)
      }

      let acceptedDistance = 0
      // Permitir un mínimo subpaso hasta 1e-8: con 8 intentos y un umbral
      // elevado, los vehículos se quedaban congelados cerca de un punto final.
      let candidate = permitted
      for (let attempt = 0; attempt < 24 && candidate >= 1e-8; attempt++) {
        if (eligible(candidate)) { acceptedDistance = candidate; break }
        candidate /= 2
      }
      if (acceptedDistance === 0) continue  // Hay un automóvil bloqueando físicamente

      v.d = Math.min(path.length, v.d + acceptedDistance)
      const pose = path.at(v.d)
      v.x = pose.x
      v.z = pose.z
      v.yaw = pose.yaw
      if (atMerge && v.x >= -2.85 && v.x < 3.65 && this.mergeOwner === null) {
        this.mergeOwner = v.id
      }
      if (atMerge && v.x >= 3.65 && this.mergeOwner === v.id) {
        this.mergeOwner = null
      }
      // Si termina el tramo, procesar el evento en este mismo tick, en lugar
      // de esperar un avance flotante adicional que puede no producirse.
      if (path.length - v.d <= 0.0001) {
        v.d = path.length
        this.atEnd(v)
      }
    }
    this.active = this.active.filter(v => v.phase !== 'finished')
  }
  advance(simSeconds: number) {
    const count = Math.ceil(simSeconds / 0.28)
    const dt = simSeconds / Math.max(1, count)
    for (let k = 0; k < count; k++) this.tick(dt)
  }
  private tick(dt: number) {
    this.t += dt
    while (this.nextArrival <= this.t) {
      if (!isOpen(this.nextArrival)) {
        this.nextArrival = nextOpening(this.nextArrival) + this.sampleArrival()
        continue
      }
      this.processArrival()
      this.nextArrival += this.sampleArrival()
    }
    this.serviceTransitions(dt)
    this.move(dt)
    this.admitOutside()
    this.maxQueue = Math.max(this.maxQueue, this.countInitialQueue())
  }
  private countInitialQueue() {
    return this.outside.length + this.active.filter(v => v.phase === 'entry' || v.phase === 'order1' || v.phase === 'order2').length
  }
  report(): Report {
    const held = (owner: number | null, stage: Phase) => {
      if (owner === null) return 'Libre'
      const v = this.all.get(owner)
      return v?.phase === stage ? 'Atendiendo' : 'En aproximación'
    }
    return {
      seconds: this.t, totalArrivals: this.arrivals, exited: this.completed,
      outsideQueue: this.outside.length,
      initialQueue: this.countInitialQueue(),
      paymentQueue: this.active.filter(v => v.phase === 'toPay1' || v.phase === 'toPay2').length,
      deliveryQueue: this.active.filter(v => v.phase === 'toDelivery').length,
      averageSystem: this.completed ? this.totalSystem / this.completed : 0,
      averageOrderService: this.serviceSamples.order ? this.serviceTotals.order / this.serviceSamples.order : 0,
      averagePaymentService: this.serviceSamples.payment ? this.serviceTotals.payment / this.serviceSamples.payment : 0,
      averageDeliveryService: this.serviceSamples.delivery ? this.serviceTotals.delivery / this.serviceSamples.delivery : 0,
      averageServiceTotal: this.fullServiceSamples ? this.fullServiceTotal / this.fullServiceSamples : 0,
      averageExitTravel: this.completed ? this.exitTravelTotal / this.completed : 0,
      averageInitialWait: this.waitSamples.initial ? this.waitTotals.initial / this.waitSamples.initial : 0,
      averagePaymentWait: this.waitSamples.payment ? this.waitTotals.payment / this.waitSamples.payment : 0,
      averageDeliveryWait: this.waitSamples.delivery ? this.waitTotals.delivery / this.waitSamples.delivery : 0,
      maxQueue: this.maxQueue,
      open: isOpen(this.t),
      visibleIds: this.active.map(v => v.id),
      travelTimeMean: this.completed ? this.totalSystem / this.completed : 0,
      servers: [
        { name: 'Citófono 1', status: held(this.orderOwner[0], 'service1'), utilization: this.activity.cit1 / Math.max(this.t, 1) },
        { name: 'Citófono 2', status: held(this.orderOwner[1], 'service2'), utilization: this.activity.cit2 / Math.max(this.t, 1) },
        { name: 'Pago', status: held(this.paymentOwner, 'payment'), utilization: this.activity.payment / Math.max(this.t, 1) },
        { name: 'Entrega', status: held(this.deliveryOwner, 'delivery'), utilization: this.activity.delivery / Math.max(this.t, 1) },
      ],
    }
  }
  getActiveVehicles() { return this.active }
  getAllVehicles() { return [...this.all.values()] }
}
