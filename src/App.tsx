import { useCallback, useMemo, useState } from 'react'
import World3D from './components/World3D'
import { AutoMacEngine, DEFAULT_PARAMETERS, type Parameters, type Report } from './model/engine'
import { clockLabel, durationLabel, nextTransition } from './model/clock'

type ParameterKey = 'arrivalMean' | 'orderMean' | 'paymentMean' | 'deliveryMean' | 'speed'
const definitions: { key:ParameterKey; name:string; unit:string; explanation:string; min:number; max:number }[] = [
  { key:'arrivalMean',name:'Intervalo medio entre llegadas',unit:'segundos',explanation:'Tiempo medio entre dos ingresos consecutivos.',min:4,max:3600 },
  { key:'orderMean',name:'Toma del pedido',unit:'segundos',explanation:'Media de atención en cada uno de los dos citófonos paralelos. El vehículo permanece detenido durante todo su servicio.',min:5,max:1800 },
  { key:'paymentMean',name:'Servicio de pago',unit:'segundos',explanation:'Media de atención en la única ventanilla de pago. Los carros posteriores esperan sin atravesarla.',min:5,max:1800 },
  { key:'deliveryMean',name:'Servicio de entrega',unit:'segundos',explanation:'Media de atención en la ventanilla de entrega. Después de recibir el pedido, el vehículo recorre la salida.',min:5,max:1800 },
  { key:'speed',name:'Velocidad de reproducción',unit:'×',explanation:'Aceleración del reloj simulado frente al reloj real. No cambia las duraciones estadísticas de los servicios.',min:1,max:300 },
]

function MetricCard({label,value,note}:{label:string;value:string|number;note?:string}) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>
}
function NumberField({config, value, onChange}:{config:typeof definitions[number];value:number;onChange:(v:number)=>void}) {
  return <label className="field" htmlFor={config.key}>
    <div><strong>{config.name}</strong><small>{config.unit}</small></div>
    <input id={config.key} type="number" min={config.min} max={config.max} step="1" value={value}
      onChange={e=>onChange(Number.isFinite(e.target.valueAsNumber)?e.target.valueAsNumber:config.min)}/>
  </label>
}
const formatPct = (x:number)=>`${(x*100).toFixed(1)} %`

export default function App(){
  const [screen,setScreen] = useState<'setup'|'simulation'>('setup')
  const [params,setParams] = useState<Parameters>({...DEFAULT_PARAMETERS})
  const [engine,setEngine] = useState<AutoMacEngine|null>(null)
  const [report,setReport] = useState<Report|null>(null)
  const [running,setRunning] = useState(true)
  const update = (key:ParameterKey, val:number) => {
    const def=definitions.find(x=>x.key===key)!
    setParams(p=>({...p,[key]:Math.max(def.min,Math.min(def.max,Math.round(val)))}))
  }
  const start = useCallback(()=>{
    const inst = new AutoMacEngine(params)
    setEngine(inst);setReport(inst.report());setRunning(true);setScreen('simulation')
  },[params])
  const transition = useMemo(()=>report ? nextTransition(report.seconds) : null,[report])
  const onTick = useCallback((data:Report)=>setReport(data),[])
  const reset=()=>{
    if (!engine) return
    const newEngine=new AutoMacEngine(params)
    setEngine(newEngine);setReport(newEngine.report());setRunning(true)
  }
  return <main className="app-shell">
    <header className="masthead">
      <div className="brand-mark">AM</div>
      <div className="brand-info">
        <h1>AutoMac <span>Pinar del Río</span></h1>
        <p>Una cola inicial · 2 citófonos paralelos · pago · entrega · salida</p>
      </div>
      <div className="top-stamp">SIMULADOR 3D</div>
    </header>
    {screen==='setup' ? <>
      <section className="hero-card">
        <div>
          <p className="eyebrow">Configuración inicial</p>
          <h2>Define las variables antes de iniciar la simulación.</h2>
          <p>El modelo genera vehículos mientras el establecimiento está abierto y reproduce su avance por el recorrido del AutoMac. Cada estación detiene al vehículo durante su atención. El reloj comienza a las 09:58, dos minutos antes de abrir, y respeta los cierres y reaperturas.</p>
          <div className="pill-row"><span>Hora de inicio 09:58</span><span>2 puntos de pedido</span><span>1 pago</span><span>1 entrega</span></div>
        </div>
        <div className="hero-route">
          <div>ENTRADA / COLA</div><div className="branch"><span>CITÓFONO 1</span><span>CITÓFONO 2</span></div>
          <div>PAGO</div><div>ENTREGA</div><div>SALIDA</div>
        </div>
      </section>
      <section className="columns-setup">
        <div className="panel">
          <div className="section-heading"><div><p className="eyebrow">Parámetros</p><h3>Configuración del experimento</h3></div></div>
          <div className="field-stack">{definitions.map(def=><NumberField key={def.key} config={def} value={params[def.key]} onChange={v=>update(def.key,v)}/>)}</div>
          <div className="form-feedback">
            <strong>Tasa media de llegadas: {(3600/params.arrivalMean).toFixed(1)} vehículos/h (durante la apertura)</strong>
            <span>Capacidad conjunta de citófonos: {(7200/params.orderMean).toFixed(1)} vehículos/h</span>
            {3600/params.arrivalMean > 7200/params.orderMean && <p>La demanda supera la capacidad nominal de los citófonos. Se formará una cola creciente mientras persista esta condición.</p>}
          </div>
          <button className="primary-btn wide" onClick={start}>Iniciar simulación 3D <span>→</span></button>
        </div>
        <div className="panel">
          <div className="section-heading"><div><p className="eyebrow">Guía de parámetros</p><h3>Qué significa cada variable</h3></div></div>
          <div className="definition-stack">{definitions.map(def=><div className="definition" key={def.key}><strong>{def.name}</strong><p>{def.explanation}</p></div>)}</div>
          <div className="note-box"><strong>Distribuciones del modelo</strong><p>No existe una cantidad predeterminada de vehículos: las llegadas continúan durante todos los horarios de apertura. Los intervalos entre llegadas se generan con distribución exponencial. Los servicios presentan variación triangular acotada al ±35 % de la media configurada. Son supuestos del simulador, no distribuciones verificadas con la muestra real.</p></div>
        </div>
      </section>
      <section className="note-row"><strong>Horario automático</strong><p>Se aplican los periodos de atención suministrados, con sus cierres nocturnos y reaperturas. El reloj comienza a las 09:58, con el AutoMac cerrado, y continúa hasta las 10:00 para iniciar las llegadas. Después avanza sin interrupción, incluso al pasar la medianoche. Durante el cierre no ingresan nuevos vehículos; los que ya entraron completan su recorrido. La pantalla de simulación mostrará el estado operativo y la próxima transición.</p></section>
    </> : engine && report && <>
      <section className="simulation-toolbar">
        <div className="time-block"><span>Hora del establecimiento</span><strong>{clockLabel(report.seconds)}</strong><small>Tiempo transcurrido: {durationLabel(report.seconds)}</small></div>
        <div className={`operation-status ${report.open?'opened':'closed'}`}>
          <strong>{report.open?'Abierto':'Cerrado'}</strong>
          <span>{transition ? `${transition.willOpen?'Reabre':'Cierra'} en ${durationLabel(transition.inSeconds)}` : ''}</span>
        </div>
        <div className="toolbar-actions"><button className="neutral-btn" onClick={()=>setScreen('setup')}>Variables</button><button className="neutral-btn" onClick={reset}>Reiniciar</button><button className="primary-btn" onClick={()=>setRunning(x=>!x)}>{running?'Pausar':'Continuar'}</button></div>
      </section>
      <section className="metric-grid">
        <MetricCard label="Vehículos que salieron" value={report.exited} note={`${report.totalArrivals} han llegado`}/>
        <MetricCard label="Cola inicial" value={report.initialQueue} note={`${report.outsideQueue} esperan fuera del tramo`}/>
        <MetricCard label="Cola de pago" value={report.paymentQueue}/>
        <MetricCard label="Cola de entrega" value={report.deliveryQueue}/>
        <MetricCard label="Permanencia promedio" value={durationLabel(report.averageSystem)} note="Desde llegada hasta salida"/>
        <MetricCard label="Máx. cola inicial" value={report.maxQueue}/>
      </section>
      <section className="simulation-grid">
        <div className="scene-panel">
          <div className="panel-title"><strong>Vista tridimensional del AutoMac</strong><span>Arrastra para girar · rueda para acercar</span></div>
          <div className="scene-viewport"><World3D engine={engine} report={report} running={running} onTick={onTick}/></div>
          <div className="scene-footer"><span>Inicio a las 09:58 · cierre y reapertura automáticos</span><span>Velocidad ×{params.speed}</span></div>
        </div>
        <aside className="panel aside-panel">
          <p className="eyebrow">Recursos de atención</p><h3>Estado de estaciones</h3>
          <div className="server-stack">{report.servers.map(s=><div className="server-row" key={s.name}>
            <div><strong>{s.name}</strong><small>Uso: {formatPct(s.utilization)}</small></div>
            <span className={`server-state ${s.status==='Libre'?'idle':s.status==='Atendiendo'?'busy':'moving'}`}>{s.status}</span>
          </div>)}</div>
          <div className="sidebar-note"><strong>Condiciones del experimento</strong><p>Los vehículos avanzan por carriles delimitados, respetan una distancia mínima y permanecen detenidos durante el servicio. Cuando el ingreso representado está lleno, la espera continúa fuera de la escena.</p></div>
          <div className="sidebar-values"><div><span>Llegadas medias</span><strong>{params.arrivalMean} s</strong></div><div><span>Pedido</span><strong>{params.orderMean} s</strong></div><div><span>Pago</span><strong>{params.paymentMean} s</strong></div><div><span>Entrega</span><strong>{params.deliveryMean} s</strong></div></div>
        </aside>
      </section>
      <div className="small-print">Los valores introducidos son parámetros de simulación, no mediciones de campo.</div>
    </>}
  </main>
}
