import ts from 'typescript'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'

const dir = await mkdtemp(resolve('.automac-test-'))
try {
  await writeFile(resolve(dir, 'package.json'), '{"type":"commonjs"}')
  for (const name of ['clock','routes','engine']) {
    const source = await (await import('node:fs/promises')).readFile(resolve('src/model', name+'.ts'),'utf8')
    const output = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
    await writeFile(resolve(dir,name+'.js'),output)
  }
  const require = createRequire(resolve(dir,'engine.js'))
  const { AutoMacEngine, DEFAULT_PARAMETERS } = require('./engine.js')
  const { clockLabel, isOpen, nextOpening, nextTransition } = require('./clock.js')
  assert.equal(clockLabel(0), '09:58:00')
  assert.equal(isOpen(0), false)
  assert.equal(nextOpening(0), 120)
  assert.equal(isOpen(119.9), false)
  assert.equal(isOpen(120), true)
  assert.equal(nextTransition(0).willOpen,true)
  assert.equal(Math.round(nextTransition(0).inSeconds),120)
  // Verificar el calendario de lunes a domingo, en el ciclo semanal.
  const day = 86400
  const cases = [
    [0,10,0,true], // lunes
    [1,2,59,true], [1,3,0,false], [1,10,0,true], // martes
    [2,22,39,true], [2,22,40,false], // miércoles
    [3,9,59,false], [3,10,0,true], // jueves
    [4,4,59,true], [4,5,0,false], // viernes
    [5,2,0,true], [5,6,0,false], // sábado
    [6,2,0,true], [6,6,0,false], // domingo
  ]
  for (const [dayIndex,h,m,expected] of cases) {
    const elapsed = dayIndex*day+h*3600+m*60-(9*3600+58*60)
    assert.equal(isOpen(elapsed),expected,`Horario incorrecto para el día ${dayIndex}, ${h}:${m}`)
  }
  const first = new AutoMacEngine({...DEFAULT_PARAMETERS, seed:123})
  assert.equal(first.report().totalArrivals,0)
  assert.equal(first.report().open,false)
  first.advance(119)
  assert.equal(first.report().totalArrivals,0)
  first.advance(1)
  assert.equal(first.report().open,true)
  assert.equal(first.report().totalArrivals,0)
  first.advance(3600)
  assert.ok(first.report().totalArrivals>0, 'No llegaron vehículos después de abrir')
  assert.ok(first.report().exited>0, 'Ningún vehículo salió')
  // La simulación nunca termina por una cantidad fija.
  const contin = new AutoMacEngine({ ...DEFAULT_PARAMETERS, arrivalMean:75, seed:8 })
  contin.advance(3*3600)
  assert.ok(contin.report().totalArrivals>40,'Se encontró un límite artificial de vehículos')
  // Cierres y reaperturas: no se deben programar llegadas en periodos cerrados.
  const tracker = new AutoMacEngine({ ...DEFAULT_PARAMETERS, arrivalMean:110,seed:32 })
  const arrivalsAt = []
  const original = tracker.processArrival.bind(tracker)
  tracker.processArrival = () => { arrivalsAt.push(tracker.t); original() }
  for(let i=0;i<29*6;i++) tracker.advance(600)
  assert.ok(tracker.report().totalArrivals>100)
  assert.ok(arrivalsAt.every(t=>isOpen(t)),'Hubo llegadas durante un cierre')
  // El reloj atravesó al menos un cierre y una reapertura.
  assert.ok(arrivalsAt.some(t=>t>15*3600))
  // Vehículos nunca se solapan: distancia mínima entre sus centros.
  const heavy = new AutoMacEngine({ ...DEFAULT_PARAMETERS, arrivalMean:26, orderMean:260, paymentMean:150,deliveryMean:160,seed:2026 })
  let maxVisible = 0
  for(let i=0;i<2400;i++){
    heavy.advance(5)
    if (i%5) continue
    const active=heavy.getActiveVehicles()
    maxVisible=Math.max(maxVisible,active.length)
    for(let j=0;j<active.length;j++)for(let k=j+1;k<active.length;k++){
      const x=active[j].x-active[k].x, z=active[j].z-active[k].z
      assert.ok(x*x+z*z>=(heavy.minGap-0.015)**2,`Vehículos superpuestos en t=${heavy.t}: ${active[j].id} y ${active[k].id}`)
    }
  }
  assert.ok(heavy.report().exited>0,'El tráfico quedó completamente detenido')
  console.log('Pruebas superadas: reloj, horarios, llegadas continuas, cierre/reapertura, cola y distancia entre vehículos.')
  console.log(JSON.stringify({vehiculosRegistrados:tracker.report().totalArrivals,vehiculosAltaDemanda:heavy.report().totalArrivals,salidasAltaDemanda:heavy.report().exited,maxVisibles:maxVisible},null,2))
} finally {await rm(dir,{recursive:true,force:true})}
