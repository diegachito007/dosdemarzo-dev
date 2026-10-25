import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import { FaBell, FaEye, FaFilePdf, FaUserCheck } from "react-icons/fa";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { db } from "../lib/firebase";
import { fechaLimiteISO, generarPdfNotificacion, nombrePdfNotificacion } from "../utils/notificacionNotas";
import { claveEstudiante, corregirInasistencia, diaEcuador, estadoNotificacion, guardarAtencion, guardarPapel, hoyEcuador, mostrarFecha, registrarInasistencia, type AtencionRepresentante, type DecisionRefuerzo, type NotificacionRegistrada } from "../utils/seguimientoNotificaciones";

const boton="inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50";
const campo="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const celda="px-3 py-2 text-left align-top";
const decisiones:Record<DecisionRefuerzo,string>={pendiente:"Pendiente de decidir",ninguno:"No corresponde",informal:"Refuerzo informal",formal:"Refuerzo formal"};
interface CambioSeguimiento {
  id:string; docenteId:string; notificacionId?:string; notificacionIds?:string[]; atencionId?:string;
  accion:string; motivo?:string; registradoEn?:{toDate:()=>Date};
  despues?:{fecha?:string;asistente?:string;atencionFirmada?:boolean;actaFirmada?:boolean;refuerzo?:DecisionRefuerzo};
}
type Grupo={clave:string;notas:NotificacionRegistrada[]};

export default function Notificaciones() {
  const {user}=useAuth();
  const {anioActivo,aniosLectivos}=useData();
  const [datos,setDatos]=useState<{uid:string;notas:NotificacionRegistrada[];atenciones:AtencionRepresentante[];notasListas:boolean;atencionesListas:boolean}>({uid:"",notas:[],atenciones:[],notasListas:false,atencionesListas:false});
  const [error,setError]=useState("");const [aviso,setAviso]=useState("");
  const [buscar,setBuscar]=useState("");const [anio,setAnio]=useState("actual");const [estado,setEstado]=useState("todos");
  const [cambios,setCambios]=useState<{uid:string;items:CambioSeguimiento[]}>({uid:"",items:[]});
  const [verCambios,setVerCambios]=useState(false);
  const [grupoSel,setGrupoSel]=useState<string|null>(null);
  const [form,setForm]=useState<AtencionRepresentante|null>(null);
  const [papel,setPapel]=useState<{nota:NotificacionRegistrada;fecha:string;referencia:string}|null>(null);
  const [ocupado,setOcupado]=useState(false);const bloqueo=useRef(false);
  const uid=user?.uid || "";
  useEffect(()=>{
    if(!uid)return;
    const unsubNotas=onSnapshot(query(collection(db,"notificacionesNotasHistorial"),where("docenteId","==",uid)),snap=>{
      setDatos(prev=>({uid,atenciones:prev.uid===uid?prev.atenciones:[],atencionesListas:prev.uid===uid && prev.atencionesListas,notas:snap.docs.map(d=>({...d.data(),id:d.id}) as NotificacionRegistrada),notasListas:true}));
    },()=>setError("No se pudieron consultar las notificaciones. Revisa conexión y permisos de Firestore."));
    const unsubAtenciones=onSnapshot(query(collection(db,"notificacionesNotasAtenciones"),where("docenteId","==",uid)),snap=>{
      setDatos(prev=>({uid,notas:prev.uid===uid?prev.notas:[],notasListas:prev.uid===uid && prev.notasListas,atenciones:snap.docs.map(d=>({...d.data(),id:d.id}) as AtencionRepresentante),atencionesListas:true}));
    },()=>setError("No se pudieron consultar las atenciones. Revisa conexión y permisos de Firestore."));
    return()=>{unsubNotas();unsubAtenciones();};
  },[uid]);
  useEffect(()=>{
    if(!uid || !grupoSel || !verCambios)return;
    return onSnapshot(query(collection(db,"notificacionesNotasAuditoria"),where("docenteId","==",uid)),snap=>{
      setCambios({uid,items:snap.docs.map(d=>({...d.data(),id:d.id}) as CambioSeguimiento)});
    },()=>setError("No se pudo consultar el historial de cambios. Revisa los permisos."));
  },[uid,grupoSel,verCambios]);
  const notas=useMemo(()=>datos.uid===uid?datos.notas:[],[datos,uid]);
  const atenciones=useMemo(()=>datos.uid===uid?datos.atenciones:[],[datos,uid]);
  const grupos=useMemo(()=>{
    const mapa=new Map<string,NotificacionRegistrada[]>();
    notas.forEach(n=>{const k=claveEstudiante(n);mapa.set(k,[...(mapa.get(k)||[]),n]);});
    return Array.from(mapa,([clave,notas])=>({clave,notas:notas.sort((a,b)=>(b.fechaEnvio||b.fecha).localeCompare(a.fechaEnvio||a.fecha))})).sort((a,b)=>a.notas[0].informe.estudiante.localeCompare(b.notas[0].informe.estudiante));
  },[notas]);
  const visibles=grupos.filter(g=>{
    const i=g.notas[0].informe;
    if(anio!=="todos" && i.anioId!==(anio==="actual"?anioActivo?.id:anio))return false;
    if(buscar && !g.notas.some(n=>`${n.informe.estudiante} ${n.informe.grado} ${n.informe.materia} ${n.informe.representante}`.toLocaleLowerCase().includes(buscar.toLocaleLowerCase())))return false;
    if(estado==="pendientes" && !g.notas.some(n=>!n.seguimiento?.primeraAtencion))return false;
    if(estado==="vencidas" && !g.notas.some(n=>!n.seguimiento?.primeraAtencion && hoyEcuador()>fechaLimiteISO(n)))return false;
    if(estado==="atendidos" && !g.notas.some(n=>n.seguimiento?.primeraAtencion))return false;
    return true;
  });
  const seleccionado=grupos.find(g=>g.clave===grupoSel);
  const visitas=seleccionado?atenciones.filter(a=>seleccionado.notas.some(n=>a.notificacionIds.includes(n.id))).sort((a,b)=>b.fecha.localeCompare(a.fecha)):[];
  const cargando=datos.uid!==uid || !datos.notasListas || !datos.atencionesListas;
  const ejecutar=async(accion:()=>Promise<void>,mensaje:string)=>{
    if(bloqueo.current)return;bloqueo.current=true;setOcupado(true);setError("");setAviso("");
    try {if(!navigator.onLine)throw Error("Necesitas conexión para guardar el seguimiento.");await accion();setAviso(mensaje);}
    catch(e){setError(e instanceof Error?e.message:"No se pudo guardar el registro.");}
    finally {bloqueo.current=false;setOcupado(false);}
  };
  const abrirAtencion=(g:Grupo)=>{
    const i=g.notas[0].informe;
    setForm({id:crypto.randomUUID(),docenteId:uid,estudianteId:i.estudianteId,estudiante:i.estudiante,anioId:i.anioId,gradoId:i.gradoId,
      notificacionIds:g.notas.filter(n=>!n.seguimiento?.primeraAtencion).slice(0,50).map(n=>n.id),fecha:hoyEcuador(),asistente:i.representante||"",
      atencionFirmada:false,actaFirmada:false,refuerzo:"pendiente",referenciaFisica:"",observaciones:"",revision:0,operacionId:crypto.randomUUID()});
  };
  const descargar=(n:NotificacionRegistrada)=>{
    try {generarPdfNotificacion(n).save(nombrePdfNotificacion(n));}
    catch {setError("No se pudo generar el PDF de la notificación.");}
  };
  const grupoForm=form?grupos.find(g=>g.notas[0].informe.estudianteId===form.estudianteId && g.notas[0].informe.anioId===form.anioId && g.notas[0].informe.gradoId===form.gradoId):null;
  return <Layout title="Notificaciones" subtitle="Seguimiento de citaciones y atención a representantes">
    <div className="space-y-4 text-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="flex items-center gap-2 text-lg font-bold"><FaBell/>Mis notificaciones</h1><Link to="/reporte-notas" className={boton}>Ir a Reporte Notas</Link></div>
      <p className="text-xs text-slate-600">Se muestran los envíos confirmados de tu cuenta. Cada número se identifica también por estudiante, materia y período.</p>
      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}<button className="ml-3 underline" onClick={()=>setError("")}>Cerrar aviso</button></div>}
      {aviso && <p role="status" className="rounded bg-green-50 p-3 text-sm text-green-800">{aviso}</p>}
      <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-3">
        <label className="text-xs">Buscar estudiante, representante o materia<input value={buscar} onChange={e=>setBuscar(e.target.value)} className={campo}/></label>
        <label className="text-xs">Año lectivo<select value={anio} onChange={e=>setAnio(e.target.value)} className={campo}><option value="actual">Año activo</option><option value="todos">Todos los años</option>{[...new Set(notas.map(n=>n.informe.anioId))].map(id=><option key={id} value={id}>{aniosLectivos.find(a=>a.id===id)?.nombre || "Año anterior"}</option>)}</select></label>
        <label className="text-xs">Estado<select value={estado} onChange={e=>setEstado(e.target.value)} className={campo}><option value="todos">Todos</option><option value="pendientes">Con notificaciones sin atención</option><option value="vencidas">Con plazos vencidos sin atención</option><option value="atendidos">Con atención registrada</option></select></label>
      </div>
      {cargando?<p className="p-5 text-sm">Cargando notificaciones y atenciones…</p>:<div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full text-xs"><thead className="bg-slate-100"><tr>{["Estudiante / grado","Notificaciones","Sin atención","Plazos vencidos sin atención","Visitas registradas","Acciones"].map(t=><th key={t} className={celda}>{t}</th>)}</tr></thead><tbody>{visibles.map(g=>{
        const i=g.notas[0].informe;return <tr key={g.clave} className="border-t border-slate-200"><td className={celda}><strong>{i.estudiante}</strong><p>{i.grado}</p></td><td className={celda}>{g.notas.length}</td><td className={celda}>{g.notas.filter(n=>!n.seguimiento?.primeraAtencion).length}</td><td className={celda}>{g.notas.filter(n=>!n.seguimiento?.primeraAtencion && hoyEcuador()>fechaLimiteISO(n)).length}</td><td className={celda}>{atenciones.filter(a=>g.notas.some(n=>a.notificacionIds.includes(n.id))).length}</td><td className={celda}><div className="flex gap-1"><button className={boton} onClick={()=>setGrupoSel(g.clave)} title="Ver notificaciones e historial"><FaEye/>Detalle</button><button className={boton} disabled={ocupado} onClick={()=>abrirAtencion(g)}><FaUserCheck/>Registrar visita</button></div></td></tr>;
      })}{!visibles.length && <tr><td className="p-6 text-center" colSpan={6}>No hay notificaciones confirmadas que coincidan con los filtros.</td></tr>}</tbody></table></div>}
      {seleccionado && <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{seleccionado.notas[0].informe.estudiante} · {seleccionado.notas[0].informe.grado}</h2><button className={boton} onClick={()=>setGrupoSel(null)}>Cerrar detalle</button></div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-100"><tr>{["Notificación / materia / período","Envío","Fecha límite","Estado / fecha de atención","Documento físico","Acciones"].map(t=><th key={t} className={celda}>{t}</th>)}</tr></thead><tbody>{seleccionado.notas.map(n=>{
          const atendidoEnPlazo=!!n.seguimiento?.primeraAtencion && n.seguimiento.primeraAtencion<=fechaLimiteISO(n);
          return <tr key={n.id} className="border-t border-slate-200"><td className={celda}><strong>N.º {n.numero} · {n.informe.materia}</strong><p>{n.informe.periodo}</p></td><td className={celda}>{mostrarFecha(diaEcuador(n.fechaEnvio||n.fecha))}</td><td className={celda}>{mostrarFecha(fechaLimiteISO(n))}</td><td className={celda}><p>{estadoNotificacion(n)}</p>{n.seguimiento?.primeraAtencion && <p>{mostrarFecha(n.seguimiento.primeraAtencion)}</p>}{n.seguimiento?.inasistencia && <p className="mt-1 text-amber-800">{atendidoEnPlazo?"Existe una marca de inasistencia previa; revisa la fecha de visita registrada.":`Inasistencia al plazo ${mostrarFecha(n.seguimiento.inasistencia.fechaLimite)} registrada`}</p>}</td><td className={celda}>{n.seguimiento?.papel?<><p>✓ Entregado: {mostrarFecha(n.seguimiento.papel.fecha)}</p><p>{n.seguimiento.papel.referencia}</p></>:"Sin entrega registrada"}<button className={`${boton} mt-1`} disabled={ocupado} onClick={()=>setPapel({nota:n,fecha:n.seguimiento?.papel?.fecha||hoyEcuador(),referencia:n.seguimiento?.papel?.referencia||""})}>{n.seguimiento?.papel?"Editar entrega":"Registrar entrega"}</button></td><td className={celda}><div className="flex flex-col items-start gap-1"><button className={boton} onClick={()=>descargar(n)}><FaFilePdf/>PDF original</button><button className={boton} disabled={ocupado || !!n.seguimiento?.inasistencia || atendidoEnPlazo || hoyEcuador()<=fechaLimiteISO(n)} onClick={()=>{
            if(window.confirm(`¿Registrar que el representante no asistió hasta el ${mostrarFecha(fechaLimiteISO(n))} para la notificación N.º ${n.numero} de ${n.informe.materia}?`))void ejecutar(()=>registrarInasistencia(uid,n,crypto.randomUUID()),"Inasistencia registrada sin modificar la notificación original.");
          }}>Registrar que no asistió</button>{n.seguimiento?.inasistencia && <button className={boton} disabled={ocupado} onClick={()=>{
            const motivo=window.prompt("Motivo para corregir la marca de inasistencia (se conservará el cambio en el historial):");
            if(motivo?.trim())void ejecutar(()=>corregirInasistencia(uid,n,motivo,crypto.randomUUID()),"Marca corregida. La modificación quedó registrada.");
          }}>Corregir marca</button>}</div></td></tr>;
        })}</tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Atenciones y documentos firmados</h3><button className={boton} disabled={ocupado} onClick={()=>abrirAtencion(seleccionado)}>Registrar nueva visita</button></div>
        {visitas.length===0?<p className="text-xs text-slate-500">No hay visitas registradas.</p>:visitas.map(v=><article key={v.id} className="rounded-md border border-slate-200 p-3 text-xs"><div className="flex items-center justify-between gap-2"><strong>{mostrarFecha(v.fecha)} · {v.asistente}</strong><button className={boton} disabled={ocupado} onClick={()=>setForm({...v,operacionId:crypto.randomUUID()})}>Actualizar verificadores</button></div><p className="mt-2">Notificaciones atendidas: {seleccionado.notas.filter(n=>v.notificacionIds.includes(n.id)).map(n=>`N.º ${n.numero} (${n.informe.materia}, ${n.informe.periodo})`).join("; ")}</p><p className="mt-1">{v.atencionFirmada?"✓":"□"} Atención a padres firmada · {v.actaFirmada?"✓":"□"} Acta de bajo rendimiento firmada · {decisiones[v.refuerzo]}</p><p className="mt-1">Archivo físico: {v.referenciaFisica||"Sin referencia"}</p>{v.observaciones && <p className="mt-1 whitespace-pre-wrap">{v.observaciones}</p>}</article>)}
        <button className={boton} onClick={()=>setVerCambios(!verCambios)}>{verCambios?"Ocultar cambios":"Ver historial de cambios"}</button>
        {verCambios && <div className="space-y-2 rounded bg-slate-50 p-3 text-xs"><h3 className="font-semibold">Cambios registrados por tu cuenta</h3>{(cambios.uid===uid?cambios.items:[]).filter(c=>seleccionado.notas.some(n=>n.id===c.notificacionId || c.notificacionIds?.includes(n.id))).sort((a,b)=>(b.registradoEn?.toDate().getTime()||0)-(a.registradoEn?.toDate().getTime()||0)).map(c=><article className="border-b border-slate-200 pb-2" key={c.id}><strong>{({registrar_inasistencia:"Inasistencia registrada",corregir_inasistencia:"Inasistencia corregida",registrar_entrega_fisica:"Entrega física guardada",registrar_atencion:"Visita registrada",actualizar_atencion:"Verificadores actualizados"} as Record<string,string>)[c.accion] || c.accion}</strong><p>{c.registradoEn?.toDate().toLocaleString("es-EC",{timeZone:"America/Guayaquil"})||"Confirmando fecha…"}</p>{c.motivo && <p>Motivo: {c.motivo}</p>}{c.despues?.asistente && <p>{c.despues.asistente} · visita {mostrarFecha(c.despues.fecha)} · Atención firmada: {c.despues.atencionFirmada?"Sí":"No"} · Acta firmada: {c.despues.actaFirmada?"Sí":"No"} · {decisiones[c.despues.refuerzo || "pendiente"]}</p>}</article>)}</div>}
      </section>}
      <p className="text-xs text-slate-500">Los vistos registran que verificaste las firmas físicas; no son firmas digitales ni copias de los documentos. La decisión de refuerzo no aplica calificaciones ni crea un proceso automáticamente.</p>
    </div>
    {form && grupoForm && <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-3"><section role="dialog" aria-modal="true" aria-labelledby="visita-titulo" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 text-slate-700">
      <h2 id="visita-titulo" className="font-bold">{form.revision?"Actualizar verificadores de la visita":"Registrar atención a representante"}</h2><p className="my-2 text-sm">{form.estudiante}</p>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={e=>{e.preventDefault();void ejecutar(async()=>{await guardarAtencion(uid,form,form.revision,form.operacionId);setForm(null);},"Atención guardada y vinculada a las notificaciones seleccionadas.");}} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">Fecha real de atención<input type="date" required max={hoyEcuador()} disabled={ocupado} value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} className={campo}/></label><label className="text-xs">Nombre de quien asistió<input required maxLength={200} disabled={ocupado} value={form.asistente} onChange={e=>setForm({...form,asistente:e.target.value})} className={campo}/></label></div>
        <fieldset disabled={ocupado || form.revision>0} className="max-h-44 overflow-y-auto rounded border border-slate-200 p-3"><legend className="text-xs font-semibold">Notificaciones atendidas en esta visita ({form.notificacionIds.length}, máximo 50)</legend>{grupoForm.notas.map(n=><label key={n.id} className="mb-2 flex items-start gap-2 text-xs"><input type="checkbox" checked={form.notificacionIds.includes(n.id)} onChange={e=>setForm({...form,notificacionIds:e.target.checked?[...form.notificacionIds,n.id]:form.notificacionIds.filter(id=>id!==n.id)})}/><span>N.º {n.numero} · {n.informe.materia} · {n.informe.periodo} · plazo {mostrarFecha(fechaLimiteISO(n))}{n.seguimiento?.primeraAtencion?" · Ya tiene atención previa":""}</span></label>)}</fieldset>
        {form.revision>0 && <p className="text-xs text-slate-500">Las notificaciones vinculadas se conservan. Puedes corregir la fecha o los verificadores; los cambios quedan en el historial. Para otra visita, crea un registro nuevo.</p>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={ocupado} checked={form.atencionFirmada} onChange={e=>setForm({...form,atencionFirmada:e.target.checked})}/>Documento de atención a padres firmado en físico</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={ocupado} checked={form.actaFirmada} onChange={e=>setForm({...form,actaFirmada:e.target.checked})}/>Acta de bajo rendimiento firmada en físico</label>
        <label className="block text-xs">Decisión sobre refuerzo<select value={form.refuerzo} disabled={ocupado} onChange={e=>setForm({...form,refuerzo:e.target.value as DecisionRefuerzo})} className={campo}>{Object.entries(decisiones).map(([id,nombre])=><option key={id} value={id}>{nombre}</option>)}</select></label>
        <label className="block text-xs">Referencia del archivo físico (carpeta, folio o número de acta)<input maxLength={500} disabled={ocupado} value={form.referenciaFisica} onChange={e=>setForm({...form,referenciaFisica:e.target.value})} className={campo}/></label>
        <label className="block text-xs">Observaciones, acuerdos o aclaraciones<textarea maxLength={4000} disabled={ocupado} value={form.observaciones} onChange={e=>setForm({...form,observaciones:e.target.value})} className={campo} rows={3}/></label>
        <button type="submit" disabled={ocupado || !form.notificacionIds.length} className={`${boton} w-full bg-green-700 text-white`}>{ocupado?"Guardando…":"Guardar atención y verificadores"}</button><button type="button" disabled={ocupado} className={`${boton} w-full`} onClick={()=>setForm(null)}>Cancelar</button>
      </form>
    </section></div>}
    {papel && <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-3"><section role="dialog" aria-modal="true" aria-labelledby="papel-titulo" className="w-full max-w-md rounded-lg bg-white p-5 text-slate-700"><h2 id="papel-titulo" className="font-bold">Entrega del documento al estudiante</h2><p className="my-2 text-xs">N.º {papel.nota.numero} · {papel.nota.informe.materia} · {papel.nota.informe.estudiante}</p>{error && <p role="alert" className="my-2 text-sm text-red-700">{error}</p>}<form className="space-y-3" onSubmit={e=>{e.preventDefault();void ejecutar(async()=>{await guardarPapel(uid,papel.nota,papel.fecha,papel.referencia,crypto.randomUUID());setPapel(null);},"Entrega física registrada.");}}><label className="block text-xs">Fecha de entrega<input type="date" required max={hoyEcuador()} disabled={ocupado} value={papel.fecha} onChange={e=>setPapel({...papel,fecha:e.target.value})} className={campo}/></label><label className="block text-xs">Referencia del papel o talonario<input maxLength={500} disabled={ocupado} value={papel.referencia} onChange={e=>setPapel({...papel,referencia:e.target.value})} className={campo}/></label><button disabled={ocupado} className={`${boton} w-full bg-green-700 text-white`}>Guardar entrega física</button><button type="button" disabled={ocupado} className={`${boton} w-full`} onClick={()=>setPapel(null)}>Cancelar</button></form></section></div>}
  </Layout>;
}
