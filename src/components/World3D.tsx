import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, DoubleSide, type Group } from 'three'
import { AutoMacEngine } from '../model/engine'
import { routes, type PathName, type Route } from '../model/routes'
import type { Report } from '../model/engine'

function Road({ route, width }: { route: Route; width: number }) {
  const geometry = useMemo(() => {
    const pts = route.points
    const vertices: number[] = [], indices: number[] = []
    for (let i = 0; i < pts.length; i++) {
      const before = pts[Math.max(0, i-1)]
      const after = pts[Math.min(pts.length-1, i+1)]
      const dx = after.x-before.x, dz = after.z-before.z
      const len = Math.hypot(dx, dz) || 1
      const nx = -dz/len*width/2, nz = dx/len*width/2
      vertices.push(pts[i].x+nx, 0.038, pts[i].z+nz, pts[i].x-nx, 0.038, pts[i].z-nz)
      if (i > 0) { const k = i*2; indices.push(k-2,k-1,k, k-1,k+1,k) }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(vertices),3))
    g.setIndex(indices)
    g.computeVertexNormals()
    return g
  }, [route,width])
  return <mesh geometry={geometry} receiveShadow>
    <meshStandardMaterial color="#263f54" roughness={0.96} side={DoubleSide}/>
  </mesh>
}

function RoadCenterMarks({ route }: { route: Route }) {
  const marks = useMemo(() => {
    const items: {x:number,z:number,yaw:number}[] = []
    for(let d=3; d<route.length-1; d+=4.5) items.push(route.at(d))
    return items
  },[route])
  return <>{marks.map((p,i)=><mesh key={i} position={[p.x,0.052,p.z]} rotation={[0,p.yaw,0]}>
    <boxGeometry args={[0.065,0.012,1.2]}/><meshBasicMaterial color="#9dc0d1" transparent opacity={0.35}/>
  </mesh>)}</>
}

function SmallSign({ text, x, z }: { text: string; x:number; z:number }) {
  return <Html position={[x,0.4,z]} center distanceFactor={30} style={{pointerEvents:'none'}}>
    <span className="world-sign">{text}</span>
  </Html>
}

function Building() {
  return <group>
    <mesh position={[7.2,2.25,-3.7]} castShadow receiveShadow>
      <boxGeometry args={[16.4,4.5,11.6]}/>
      <meshStandardMaterial color="#f4f9ff" roughness={0.85}/>
    </mesh>
    <mesh position={[7.2,4.65,-3.7]} castShadow>
      <boxGeometry args={[17.2,0.52,12.4]}/>
      <meshStandardMaterial color="#c73743" roughness={0.62}/>
    </mesh>
    <mesh position={[6.8,2.4,2.18]}>
      <boxGeometry args={[1.8,1.3,0.09]}/><meshStandardMaterial color="#244d71" />
    </mesh>
    <mesh position={[11.8,2.4,2.18]}>
      <boxGeometry args={[1.8,1.3,0.09]}/><meshStandardMaterial color="#244d71" />
    </mesh>
    <mesh position={[6.8,3.09,2.25]}><boxGeometry args={[2,0.12,0.17]}/><meshStandardMaterial color="#b0d6e7"/></mesh>
    <mesh position={[11.8,3.09,2.25]}><boxGeometry args={[2,0.12,0.17]}/><meshStandardMaterial color="#b0d6e7"/></mesh>
    <SmallSign text="VENTANILLA DE PAGO" x={6.8} z={1.95}/>
    <SmallSign text="ENTREGA" x={11.8} z={1.95}/>
  </group>
}

function Intercom({ x, z, text }: { x: number; z: number; text: string }) {
  return <group position={[x,0,z]}>
    <mesh position={[0,0.86,0]} castShadow><boxGeometry args={[0.4,1.7,0.4]}/><meshStandardMaterial color="#217ba0"/></mesh>
    <mesh position={[0,1.6,0.02]} castShadow><boxGeometry args={[0.75,0.85,0.54]}/><meshStandardMaterial color="#eff7ff"/></mesh>
    <mesh position={[0,1.72,0.3]}><planeGeometry args={[0.52,0.47]}/><meshBasicMaterial color="#163c5b"/></mesh>
    <Html position={[0,2.58,0]} center distanceFactor={27} style={{pointerEvents:'none'}}>
      <span className="world-sign">{text}</span>
    </Html>
  </group>
}

const colors = ['#368ec7','#e77764','#80c8be','#9787cd','#d8a857','#729be0','#85ae7c','#bc8dc6']
function Vehicle3D({ id, engine }: {id:number; engine:AutoMacEngine}) {
  const ref = useRef<Group>(null)
  const color = colors[(id-1)%colors.length]
  useFrame(() => {
    const v = engine.getVehicle(id)
    if (!ref.current) return
    // Eliminar inmediatamente la representación cuando termina la salida;
    // no conservar un vehículo fantasma mientras React actualiza los indicadores.
    if (!v || v.phase === 'finished') {
      ref.current.visible = false
      return
    }
    ref.current.visible = true
    ref.current.position.set(v.x,0.26,v.z)
    ref.current.rotation.set(0,v.yaw,0)
  })
  return <group ref={ref}>
    <mesh castShadow position={[0,0.32,0]}>
      <boxGeometry args={[1.25,0.42,1.85]}/><meshStandardMaterial color={color} roughness={0.47}/>
    </mesh>
    <mesh castShadow position={[0,0.65,-0.12]}>
      <boxGeometry args={[1.05,0.42,1.02]}/><meshStandardMaterial color={color} roughness={0.48}/>
    </mesh>
    <mesh position={[0,0.66,0.43]} rotation={[-0.14,0,0]}>
      <boxGeometry args={[0.87,0.29,0.027]}/><meshStandardMaterial color="#d9f2fc" metalness={0.16} roughness={0.16}/>
    </mesh>
    <mesh position={[0,0.66,-0.67]} rotation={[0.14,0,0]}><boxGeometry args={[0.86,0.25,0.028]}/><meshStandardMaterial color="#b6dded" metalness={0.14}/></mesh>
    {[-0.58,0.58].flatMap(x=>[-0.58,0.58].map(z=><mesh key={`${x}${z}`} position={[x,0.13,z]} rotation={[0,0,Math.PI/2]}>
      <cylinderGeometry args={[0.22,0.22,0.16,10]}/><meshStandardMaterial color="#1a2936"/>
    </mesh>))}
    <mesh position={[0,0.35,0.95]}><boxGeometry args={[0.82,0.12,0.055]}/><meshBasicMaterial color="#e7f7ff"/></mesh>
  </group>
}

function SceneContents({ engine, report, running, onTick }: {
  engine:AutoMacEngine; report: Report; running:boolean; onTick:(r:Report)=>void
}) {
  const uiAccumulator = useRef(0)
  useFrame((_, delta) => {
    if (!running) return
    // Limitar saltos si el usuario cambia de pestaña.
    const simDelta = Math.min(0.045,delta)*engine.params.speed
    engine.advance(simDelta)
    uiAccumulator.current += Math.min(0.045,delta)
    if(uiAccumulator.current >= 0.115) {
      uiAccumulator.current = 0
      onTick(engine.report())
    }
  })
  return <>
    <color attach="background" args={['#d9eefc']}/>
    <ambientLight intensity={1.15}/>
    <directionalLight position={[4,24,12]} intensity={2.15} castShadow shadow-mapSize={[1024,1024]}/>
    <hemisphereLight args={['#ffffff','#a3c3d6',1.15]}/>
    <mesh position={[0,-0.1,0]} receiveShadow rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[53,44]}/><meshStandardMaterial color="#b8dce8" roughness={1}/>
    </mesh>
    <gridHelper args={[53,36,'#a3c8d7','#a3c8d7']} position={[0,-0.04,0]}/>
    {(Object.keys(routes) as PathName[]).map(key =>
      <Road key={key} route={routes[key]} width={key==='entry'?3.6:key==='exit'?3.4:2.75}/>)}
    <RoadCenterMarks route={routes.entry}/>
    <RoadCenterMarks route={routes.exit}/>
    <Building/>
    <Intercom x={-3.9} z={1.75} text="CITÓFONO 1"/>
    <Intercom x={-3.9} z={10.7} text="CITÓFONO 2"/>
    <SmallSign text="ENTRADA · COLA ÚNICA" x={-18.4} z={12.2}/>
    <SmallSign text="SALIDA" x={18.8} z={7.2}/>
    {report.outsideQueue > 0 && <Html position={[-19,2.5,-15.7]} center style={{pointerEvents:'none'}}>
      <div className="outside-note">+{report.outsideQueue} esperando fuera del recorrido</div>
    </Html>}
    {report.visibleIds.map(id => <Vehicle3D key={id} id={id} engine={engine}/>)}
    <OrbitControls makeDefault target={[0,0.5,0]} enableDamping dampingFactor={0.08} minDistance={21} maxDistance={90} maxPolarAngle={Math.PI/2.1}/>
  </>
}

export default function World3D(props: {engine:AutoMacEngine; report:Report; running:boolean; onTick:(r:Report)=>void}) {
  return <Canvas shadows camera={{position:[27,34,35], fov:48, near:0.2,far:200}} dpr={[1,1.7]} gl={{antialias:true}}>
    <SceneContents {...props}/>
  </Canvas>
}
