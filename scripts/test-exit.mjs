import ts from 'typescript';import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import { resolve } from 'node:path';import { createRequire } from 'node:module';import assert from 'node:assert/strict';
const dir=await mkdtemp(resolve('.test-exit-'));
try{
 await writeFile(resolve(dir,'package.json'),'{"type":"commonjs"}');
 for(let name of ['clock','routes','engine']){let source=await readFile(resolve('src/model',name+'.ts'),'utf8');await writeFile(resolve(dir,name+'.js'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)}
 let require=createRequire(resolve(dir,'engine.js'));const {AutoMacEngine,DEFAULT_PARAMETERS}=require('./engine.js');
 const scenarios=[...Array.from({length:35},(_,i)=>({name:'normal', seed:i+1,arrivalMean:105,orderMean:185,paymentMean:39,deliveryMean:14})),...Array.from({length:5},(_,i)=>({name:'congestion',seed:i+1,arrivalMean:25,orderMean:260,paymentMean:150,deliveryMean:160}))];
 let checks=0;
 for (const scenario of scenarios){
   const engine=new AutoMacEngine({...DEFAULT_PARAMETERS,...scenario});const track=new Map();
   let prevExited=0, lastExit=0;
   for(let second=0;second<3000;second+=2){
     engine.advance(2);
     for(const v of engine.getActiveVehicles()){
       if(v.phase==='exit'){
         if(!track.has(v.id))track.set(v.id,engine.t);
         const duration=engine.t-track.get(v.id)
         assert.ok(duration<25, `Carro ${v.id} atascado en salida ${duration}s, escenario ${scenario.name} semilla ${scenario.seed}`)
       } else track.delete(v.id)
     }
     if(engine.completed>prevExited){prevExited=engine.completed;lastExit=engine.t}
     if(engine.t>1800 && engine.t-lastExit>900) throw Error(`Motor sin salidas por 15 min, ${scenario.name}, semilla ${scenario.seed}`)
     checks++
   }
   assert.ok(engine.completed>0)
 }
 console.log(`Superadas ${checks} observaciones de movilidad en ${scenarios.length} simulaciones; ningún vehículo permaneció bloqueado en la salida.`)
}finally{await rm(dir,{recursive:true,force:true})}
