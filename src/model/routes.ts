import { CatmullRomCurve3, Vector3 } from 'three'

export type PathName = 'entry' | 'order1' | 'order2' | 'toPay1' | 'toPay2' | 'toDelivery' | 'exit'
export type Point = [number, number]

const geometry: Record<PathName, Point[]> = {
  entry: [[-19, -16.5], [-19, -12], [-19, -5], [-18.5, 2], [-17, 7], [-14.5, 10], [-11, 10.5], [-9, 9]],
  order1: [[-9, 9], [-8.5, 7.8], [-8.1, 6.5], [-7.3, 5.2], [-5.8, 4.1], [-4, 3.65]],
  order2: [[-9, 9], [-7.8, 10], [-6.2, 10.1], [-4.9, 9.3], [-4, 8.55]],
  toPay1: [[-4, 3.65], [-2.6, 3.65], [-0.6, 4.15], [1.4, 5.45], [3.4, 5.55], [6.8, 5.55]],
  toPay2: [[-4, 8.55], [-2.6, 8.5], [-0.8, 7.7], [0.8, 6.15], [2.8, 5.55], [6.8, 5.55]],
  toDelivery: [[6.8, 5.55], [8.7, 5.55], [11.8, 5.55]],
  exit: [[11.8, 5.55], [15.2, 5.55], [18.5, 5.3], [21, 4.7]],
}

export type Pose = { x: number, z: number, yaw: number }
export class Route {
  points: Vector3[]
  cum: number[] = [0]
  length = 0
  constructor(raw: Point[]) {
    const curve = new CatmullRomCurve3(raw.map(([x,z]) => new Vector3(x, 0, z)), false, 'centripetal')
    this.points = curve.getPoints(Math.max(75, raw.length * 28))
    for (let i = 1; i < this.points.length; i++) {
      this.length += this.points[i].distanceTo(this.points[i-1]); this.cum.push(this.length)
    }
  }
  at(d: number): Pose {
    const safe = Math.max(0, Math.min(this.length, d))
    let low = 0, high = this.cum.length - 1
    while (high - low > 1) {
      const mid = Math.floor((high + low) / 2)
      if (this.cum[mid] <= safe) low = mid
      else high = mid
    }
    const a = this.points[low], b = this.points[high]
    const unit = (safe - this.cum[low]) / Math.max(1e-6, this.cum[high] - this.cum[low])
    return { x: a.x + (b.x - a.x) * unit, z: a.z + (b.z - a.z) * unit,
      yaw: Math.atan2(b.x - a.x, b.z - a.z) }
  }
}
export const routes: Record<PathName, Route> = Object.fromEntries(
  Object.entries(geometry).map(([key, points]) => [key, new Route(points)]),
) as Record<PathName, Route>
