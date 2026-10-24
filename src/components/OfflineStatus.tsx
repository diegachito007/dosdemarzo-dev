import { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { changesFor, discard, retry, subscribeOffline } from '../offline/store';
import type { Change } from '../offline/model';
import { synchronize } from '../offline/sync';
import { prepareOffline } from '../offline/prepare';
export default function OfflineStatus() {
  const { user } = useAuth(); const { anioActivo, periodoActual } = useData();
  const [syncing,setSyncing] = useState(false);
  const [online,setOnline] = useState(navigator.onLine);
  const [changes,setChanges] = useState<Change[]>([]);
  const [message,setMessage] = useState(''); const [preparing,setPreparing] = useState(false);
  const { offlineReady: [offlineReady,setOfflineReady], needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.ready.then(() => setOfflineReady(true));
  }, [setOfflineReady]);
  const refresh = useCallback(() => { if (user) void changesFor(user.uid).then(setChanges).catch(()=>setMessage('No se pudo acceder al almacenamiento local. No cierres la aplicación.')); },[user]);
  useEffect(()=> {
    const status=()=>setOnline(navigator.onLine);
    const pump=()=> { refresh(); if(user) void synchronize(user.uid).catch(e=>setMessage(String(e))); };
    const syncingState=(e:Event)=>setSyncing((e as CustomEvent<boolean>).detail);
    window.addEventListener('eduX:syncing',syncingState);
    const warning=(e:Event)=>setMessage((e as CustomEvent<string>).detail);
    window.addEventListener('online',status); window.addEventListener('offline',status);
    window.addEventListener('online',pump); window.addEventListener('eduX:syncWarning',warning);
    const unsub=subscribeOffline(pump); const timer=window.setInterval(pump,15000); pump();
    return()=>{window.removeEventListener('eduX:syncing',syncingState);unsub();clearInterval(timer);window.removeEventListener('online',status);window.removeEventListener('offline',status);window.removeEventListener('online',pump);window.removeEventListener('eduX:syncWarning',warning);};
  },[user,refresh]);
  const prepare=async()=>{if(!user||!anioActivo||!periodoActual)return;setPreparing(true);try{await prepareOffline(user.uid,anioActivo.id,periodoActual.id,setMessage);}catch(e){setMessage(e instanceof Error?e.message:'No se completó la preparación.');}finally{setPreparing(false);}};
  const exportChanges=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(changes,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='cambios-pendientes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <aside className="mb-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs" aria-label="Conexión y guardado local">
    <div className="flex flex-wrap items-center gap-3" role="status">
      <strong>{online?(syncing?'Sincronizando…':'Red disponible'):'Sin conexión'}</strong>
      <span>{changes.length?`${changes.length} cambio(s) pendiente(s) de confirmar`:'Sin cambios locales pendientes'}</span>
      <span>{offlineReady?'Aplicación disponible sin conexión':'Abre con internet para preparar la aplicación'}</span>
      <button type="button" disabled={!online||preparing||!periodoActual} onClick={()=>void prepare()} className="rounded border px-2 py-1 disabled:opacity-50">{preparing?'Preparando…':'Preparar mis datos sin conexión'}</button>
      {needRefresh&&<button type="button" onClick={()=>{if(window.confirm('Guarda los formularios abiertos antes de actualizar. ¿Continuar?'))void updateServiceWorker(true);}} className="rounded border px-2 py-1">Actualizar aplicación</button>}
    </div>
    {message&&<p className="mt-2" role="status">{message}</p>}
    {changes.length>0&&<details className="mt-2"><summary>Revisar cambios pendientes</summary>
      <button type="button" onClick={exportChanges} className="my-2 rounded border px-2 py-1">Descargar respaldo de pendientes</button>
      <ul>{changes.map(c=><li key={c.key} className="mb-2 border-t py-2">
        {c.collection} · Estudiante {c.studentName || c.identity.estudianteId} · {c.identity.fecha||c.identity.actividadId}{c.identity.hora?` · ${c.identity.hora}ª hora`:''} · {c.state==='pending'?'Pendiente':c.state==='conflict'?'Revisión necesaria':'Error'}
        {c.message&&<p>{c.message}</p>}
        {c.state!=='pending'&&<><p>Tu cambio: {JSON.stringify(c.patch)}</p><button type="button" onClick={()=>void retry(c).catch(e=>setMessage(String(e)))} className="mr-2 rounded border px-2 py-1">Reintentar sin sobrescribir cambios ajenos</button>
        <button type="button" onClick={()=>{if(window.confirm('¿Descartar este cambio local? Descarga un respaldo si lo necesitas.'))void discard(c).catch(e=>setMessage(String(e)));}} className="rounded border px-2 py-1">Descartar cambio local</button></>}
      </li>)}</ul>
    </details>}
  </aside>;
}
