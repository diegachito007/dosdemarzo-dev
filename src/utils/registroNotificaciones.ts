import { deleteField, doc, getDocFromServer, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { contextoNotificacion, type BorradorNotificacion, type InformeNotificacion } from "./notificacionNotas";

export async function prepararNotificacion(informe: InformeNotificacion): Promise<BorradorNotificacion> {
  const ref=doc(db,"notificacionesNotas",contextoNotificacion(informe));
  return runTransaction(db,async tx=>{
    const snap=await tx.get(ref);const datos=snap.data();
    if(datos?.pendiente)return datos.pendiente as BorradorNotificacion;
    const nuevo: BorradorNotificacion={id:crypto.randomUUID(),numero:(datos?.enviadas || 0)+1,fecha:new Date().toISOString(),informe};
    tx.set(ref,{docenteId:informe.docenteId,anioId:informe.anioId,periodoId:informe.periodoId,estudianteId:informe.estudianteId,materiaId:informe.materiaId,enviadas:datos?.enviadas || 0,pendiente:nuevo},{merge:true});
    return nuevo;
  });
}
export async function confirmarNotificacion(borrador: BorradorNotificacion): Promise<void> {
  const contexto=contextoNotificacion(borrador.informe);
  const ref=doc(db,"notificacionesNotas",contexto);const evento=doc(db,"notificacionesNotasHistorial",borrador.id);
  const fechaEnvio=new Date().toISOString();
  await runTransaction(db,async tx=>{
    const [snap,hist]=await Promise.all([tx.get(ref),tx.get(evento)]);
    if(hist.exists())return;
    if(snap.data()?.pendiente?.id!==borrador.id)throw Error("La notificación cambió en otra sesión. Cierra y vuelve a abrir esta ventana.");
    tx.set(evento,{...borrador,contextoId:contexto,docenteId:borrador.informe.docenteId,fechaEnvio,confirmadoEn:serverTimestamp(),confirmacion:"docente"});
    tx.update(ref,{enviadas:borrador.numero,pendiente:deleteField(),updatedAt:serverTimestamp()});
  });
  await getDocFromServer(evento);
}
export async function descartarNotificacion(borrador: BorradorNotificacion): Promise<void> {
  const ref=doc(db,"notificacionesNotas",contextoNotificacion(borrador.informe));
  await runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(snap.data()?.pendiente?.id!==borrador.id)throw Error("El borrador cambió o ya fue confirmado. Cierra esta ventana.");
    tx.update(ref,{pendiente:deleteField()});
  });
}
