/** Calendario circular de siete días; el visor no requiere seleccionar un día.
 * Día base interno: lunes a las 09:58. Los tramos 23:59 incluyen todo el minuto,
 * por lo cual su límite matemático es 24:00.
 */
const DAY = 86_400
const WEEK = 7 * DAY
export const BASE_ABSOLUTE_SECONDS = DAY + 9 * 3600 + 58 * 60

// Los índices son domingo=0, lunes=1, ... sábado=6.
const operatingHours: Record<number, [number, number][]> = {
  0: [[0, 5 * 3600], [10 * 3600, DAY]],
  1: [[0, 3 * 3600], [10 * 3600, DAY]],
  2: [[0, 3 * 3600], [10 * 3600, DAY]],
  3: [[10 * 3600, 22 * 3600 + 40 * 60]],
  4: [[10 * 3600, DAY]],
  5: [[0, 5 * 3600], [10 * 3600, DAY]],
  6: [[0, 5 * 3600], [10 * 3600, DAY]],
}

const slots = Object.entries(operatingHours)
  .flatMap(([day, entries]) => entries.map(([a, b]) => ({ start: +day * DAY + a, end: +day * DAY + b })))
  .sort((a, b) => a.start - b.start)

function positiveMod(n: number, p: number) { return ((n % p) + p) % p }
export function absoluteSeconds(elapsed: number) { return BASE_ABSOLUTE_SECONDS + elapsed }
export function isOpen(elapsed: number) {
  const offset = positiveMod(absoluteSeconds(elapsed), WEEK)
  return slots.some(({ start, end }) => offset >= start && offset < end)
}
export function nextTransition(elapsed: number): { inSeconds: number, willOpen: boolean, targetElapsed: number } {
  const now = absoluteSeconds(elapsed)
  const current = isOpen(elapsed)
  const boundaries = [] as number[]
  for (let cycle = -1; cycle <= 3; cycle++) {
    for (const slot of slots) {
      boundaries.push(slot.start + cycle * WEEK, slot.end + cycle * WEEK)
    }
  }
  boundaries.sort((a,b)=>a-b)
  for (const boundary of boundaries) {
    if (boundary <= now + 1e-5) continue
    // Ignorar cambios internos entre dos periodos contiguos de apertura.
    const afterOpen = isOpen(boundary - BASE_ABSOLUTE_SECONDS + 0.02)
    const beforeOpen = isOpen(boundary - BASE_ABSOLUTE_SECONDS - 0.02)
    if (afterOpen !== beforeOpen && afterOpen !== current) {
      return { inSeconds: boundary - now, willOpen: afterOpen, targetElapsed: boundary - BASE_ABSOLUTE_SECONDS }
    }
  }
  return { inSeconds: 0, willOpen: false, targetElapsed: elapsed }
}
export function nextOpening(elapsed: number): number {
  if (isOpen(elapsed)) return elapsed
  return nextTransition(elapsed).targetElapsed
}
export function clockLabel(elapsed: number, seconds = true) {
  const n = positiveMod(Math.floor(absoluteSeconds(elapsed)), DAY)
  const h = Math.floor(n / 3600)
  const m = Math.floor((n % 3600) / 60)
  const s = n % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${seconds ? `:${String(s).padStart(2, '0')}` : ''}`
}
export function durationLabel(n: number) {
  const total = Math.max(0, Math.floor(n))
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
