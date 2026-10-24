import { collection, getDocsFromServer, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
export async function prepareOffline(uid: string, year: string, period: string, progress: (message: string) => void) {
  if (!navigator.onLine || auth.currentUser?.uid !== uid) throw new Error('Conéctate con tu cuenta para preparar los datos.');
  await navigator.storage?.persist?.();
  progress('Descargando materias…');
  const assignments = await getDocsFromServer(query(collection(db,'asignaturasDocente'),where('docenteId','==',uid),where('anioLectivoId','==',year),where('activo','==',true)));
  const grades = [...new Set(assignments.docs.map(d => String(d.data().gradoId)))];
  for (const grade of grades) {
    if (auth.currentUser?.uid !== uid) throw new Error('La sesión cambió.');
    progress(`Preparando estudiantes y actividades (${grades.indexOf(grade)+1}/${grades.length})…`);
    await getDocsFromServer(query(collection(db,'estudiantes'),where('gradoId','==',grade),where('activo','==',true)));
    const activities = await getDocsFromServer(query(collection(db,'actividades'),where('gradoId','==',grade),where('periodoId','==',period)));
    const ids = activities.docs.map(d=>d.id);
    for (let i=0;i<ids.length;i+=30) await getDocsFromServer(query(collection(db,'calificaciones'),where('actividadId','in',ids.slice(i,i+30))));
    const today = new Date(); const start = new Date(today); start.setDate(start.getDate()-(today.getDay()===0?6:today.getDay()-1));
    const dates = Array.from({length:5},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});
    await getDocsFromServer(query(collection(db,'asistencias'),where('gradoId','==',grade),where('fecha','in',dates)));
  }
  localStorage.setItem(`edux-prepared:${uid}:${period}`, new Date().toISOString());
  progress('Datos preparados: notas del período y asistencia de esta semana.');
}
