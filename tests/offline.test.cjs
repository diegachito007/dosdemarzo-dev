const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path');
const ts = require('typescript'); const { indexedDB } = require('fake-indexeddb');
const modules = new Map(); const events = new EventTarget();
const load = (name, mocks={}) => {
  if (modules.has(name)) return modules.get(name);
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname,'../src/offline',name+'.ts'),'utf8');
  const context = { exports, require: id => mocks[id] || load(id.replace('./',''), mocks),
    indexedDB, crypto:globalThis.crypto, window:events, Event, CustomEvent,
    console, navigator:{onLine:true}, setTimeout, clearTimeout, BroadcastChannel:undefined,
    Map, Set, Date, JSON, Object, Array, Error };
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  modules.set(name,exports); return exports;
};
const model=load('model'), store=load('store');
const make=(uid='u',note=5,existing)=>model.makeChange(uid,'calificaciones',{estudianteId:'e',actividadId:'a'},{estudianteId:'e',actividadId:'a',nota:note},existing);
test('stable identity separates subjects, students and attendance hours',()=>{
  const a=model.logicalKey('asistencias',{estudianteId:'e',fecha:'2026-10-24',hora:1});
  assert.notEqual(a,model.logicalKey('asistencias',{estudianteId:'e',fecha:'2026-10-24',hora:2}));
  assert.equal(a,model.logicalKey('asistencias',{hora:1,fecha:'2026-10-24',estudianteId:'e'}));
});
test('fingerprints survive timestamp serialization and property order',()=>{
  assert.equal(model.fingerprint({nota:5,updatedAt:{seconds:3,nanoseconds:8}}),model.fingerprint({updatedAt:{nanoseconds:8,seconds:3},nota:5}));
});
test('server changes conflict; acknowledged operations are idempotent',()=>{
  const c=make('model',0,{id:'legacy',data:{nota:5}});
  assert.equal(model.decideChange(c,{nota:5}),'write');
  assert.equal(model.decideChange(c,{nota:7}),'conflict');
  assert.equal(model.decideChange(c,{nota:0,offlineOperationId:c.revision}),'already-applied');
  const attendance=model.makeChange('u','asistencias',{estudianteId:'e',hora:1},{estado:'I'},{id:'legacy',data:{estado:'I'}});
  assert.equal(model.decideChange(attendance,{estado:'J'}),'conflict');
});
test('durable queue coalesces edits, retains baseline, isolates accounts and protects new revisions',async()=>{
  const first=make('persist',0,{id:'legacy',data:{nota:5}}); await store.enqueue([first]);
  const next=make('persist',6); await store.enqueue([next]);
  let rows=await store.changesFor('persist'); assert.equal(rows.length,1); assert.equal(rows[0].patch.nota,6); assert.equal(rows[0].base,first.base);assert.equal(rows[0].documentId,'legacy');
  assert.equal((await store.changesFor('someone-else')).length,0);
  // Recreate the module: emulate a page restart using the same IndexedDB database.
  modules.delete('store'); const reopened=load('store'); assert.equal((await reopened.changesFor('persist')).length,1);
  await reopened.settle(first); assert.equal((await reopened.changesFor('persist')).length,1);
  await reopened.settle(first,undefined,{id:'legacy',data:{nota:0,offlineOperationId:first.revision}});
  rows=await reopened.changesFor('persist'); assert.equal(rows[0].base,model.fingerprint({nota:0,offlineOperationId:first.revision}));
  await reopened.settle(rows[0]); assert.equal((await reopened.changesFor('persist')).length,0);
});
test('conflicts are retained; multi-row save is atomic; retries do not erase baseline',async()=>{
  const c=make('conflict'); await store.enqueue([c]);
  await store.settle(c,{state:'conflict',message:'Changed by tutor'});
  await assert.rejects(store.enqueue([model.makeChange('conflict','calificaciones',{estudianteId:'new',actividadId:'a'},{nota:8}),make('conflict',6)]));
  const rows=await store.changesFor('conflict');assert.equal(rows.length,1);assert.equal(rows[0].state,'conflict');
  await store.retry(rows[0]); const retried=(await store.changesFor('conflict'))[0];assert.equal(retried.state,'pending');assert.equal(retried.base,c.base);
  await store.discard(retried);assert.equal((await store.changesFor('conflict')).length,0);
});
test('seven separate hourly records and a two-hour block are retained',async()=>{
  const changes=Array.from({length:7},(_,i)=>model.makeChange('hours','asistencias',{gradoId:'g',ambitoId:i<2?'lengua':'otra',fecha:'2026-10-24',estudianteId:'e',hora:i+1},{estado:i===0?'I':'P'}));
  await store.enqueue(changes); const rows=await store.changesFor('hours');assert.equal(rows.length,7);assert.equal(rows.filter(r=>r.identity.ambitoId==='lengua').length,2);
  for(const row of rows)await store.discard(row);
});
test('synchronization confirms writes, reuses legacy IDs and retains stale tutor changes',async()=>{
  const docs=new Map([
    ['usuarios/sync',{status:'active',role:'docente',tutorDe:[]}],
    ['asignaturasDocente/assignment',{activo:true,docenteId:'sync',gradoId:'g',destrezaId:'materia'}],
    ['estudiantes/e',{activo:true,gradoId:'g'}],
    ['actividades/a',{gradoId:'g',dirigidaA:'ambos',destrezaId:'materia'}],
    ['calificaciones/legacy',{estudianteId:'e',actividadId:'a',nota:5}],
  ]);
  let writes=0;
  const snapshot=(ref)=>({id:ref.split('/').at(-1),exists:()=>docs.has(ref),data:()=>docs.get(ref)});
  const firestore={
    collection:(_db,name)=>name,doc:(_db,col,id)=>`${col}/${id}`,
    where:(key,op,value)=>({key,op,value}),query:(col,...filters)=>({col,filters}),
    getDocsFromServer:async q=>({docs:[...docs].filter(([ref,data])=>ref.startsWith(q.col+'/')&&q.filters.every(f=>data[f.key]===f.value)).map(([ref])=>snapshot(ref))}),
    getDocFromServer:async ref=>snapshot(ref),serverTimestamp:()=>({seconds:123,nanoseconds:0}),
    runTransaction:async(_db,fn)=>{const pending=[];await fn({get:async ref=>snapshot(ref),set:(ref,data)=>pending.push([ref,{...docs.get(ref),...data}])});for(const [ref,data]of pending){writes++;docs.set(ref,data);}},
  };
  const auth={currentUser:{uid:'sync'}};
  const sync=load('sync',{'firebase/firestore':firestore,'../lib/firebase':{auth,db:{}},'../utils/refuerzo':{recalcularInsumos:async()=>({ok:true,actualizados:0})}});
  const grade={...make('sync',8,{id:'legacy',data:docs.get('calificaciones/legacy')}),assignmentId:'assignment'};await store.enqueue([grade]);await sync.synchronize('sync');
  assert.equal((await store.changesFor('sync')).length,0);assert.equal(docs.get('calificaciones/legacy').nota,8);assert.equal([...docs.keys()].filter(k=>k.startsWith('calificaciones/')).length,1);
  const before=writes;await store.enqueue([grade]);await sync.synchronize('sync');assert.equal(writes,before);assert.equal((await store.changesFor('sync')).length,0);
  const old={gradoId:'g',ambitoId:'m',fecha:'2026-10-24',estudianteId:'e',hora:1,estado:'I'};
  docs.set('asistencias/legacy-hour',{...old,estado:'J'});
  const hour=model.makeChange('sync','asistencias',{gradoId:'g',ambitoId:'m',fecha:'2026-10-24',estudianteId:'e',hora:1},{...old,estado:'P'},{id:'legacy-hour',data:old});
  await store.enqueue([hour]);await sync.synchronize('sync');assert.equal(docs.get('asistencias/legacy-hour').estado,'J');assert.equal((await store.changesFor('sync'))[0].state,'conflict');
  await store.discard((await store.changesFor('sync'))[0]);
  docs.set('asignaturasDocente/assignment',{activo:false,docenteId:'sync',gradoId:'g',destrezaId:'materia'});
  const removed={...make('sync',9,{id:'legacy',data:docs.get('calificaciones/legacy')}),assignmentId:'assignment'};
  await store.enqueue([removed]);await sync.synchronize('sync');assert.equal(docs.get('calificaciones/legacy').nota,8);assert.equal((await store.changesFor('sync'))[0].state,'conflict');await store.discard((await store.changesFor('sync'))[0]);
  auth.currentUser={uid:'other'};await store.enqueue([make('sync',9)]);await sync.synchronize('sync');assert.equal((await store.changesFor('sync')).length,1);await store.discard((await store.changesFor('sync'))[0]);
});
