import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Grado, FichaMatricula, SolicitudMatricula } from '../types';
import { FaSearch, FaCheckCircle, FaSchool, FaUser, FaHeartbeat, FaHome, FaBook, FaArrowRight, FaArrowLeft, FaMapMarkerAlt, FaPhoneAlt, FaEnvelope, FaExclamationCircle, FaSpinner } from 'react-icons/fa';

// ✅ Interface local para Representante
export interface Representante {
  id?: string;
  cedula?: string;
  nombres?: string;
  apellidos?: string;
  parentesco: string;
  edad?: number;
  estadoCivil?: string;
  instruccion?: string;
  profesion?: string;
  lugarTrabajo?: string;
  telefonos: string[];
  email?: string;
  createdAt?: string;
}

// ✅ Función para formatear texto: MAYÚSCULAS, sin tildes y sin números
const formatText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\d/g, '')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
};

// ✅ Props del componente reutilizable
interface FormularioRepresentanteProps {
  tipo: 'madre' | 'padre' | 'otro';
  cedula: string;
  setCedula: (v: string) => void;
  datos: Partial<Representante>;
  setDatos: (v: Partial<Representante>) => void;
  color: 'pink' | 'indigo' | 'purple';
  esRepresentanteLegal: boolean;
  titulo: string;
  onBuscar: (tipo: 'madre' | 'padre' | 'otro', cedula: string) => void;
  buscando: boolean;
}

// ✅ Componente reutilizable
const FormularioRepresentante = ({
  tipo,
  cedula,
  setCedula,
  datos,
  setDatos,
  color,
  esRepresentanteLegal,
  titulo,
  onBuscar,
  buscando
}: FormularioRepresentanteProps) => {
  const colorClasses = {
    pink: { icon: 'text-pink-600', border: 'border-pink-300', bg: 'bg-pink-50', button: 'bg-pink-600 hover:bg-pink-700' },
    indigo: { icon: 'text-indigo-600', border: 'border-indigo-300', bg: 'bg-indigo-50', button: 'bg-indigo-600 hover:bg-indigo-700' },
    purple: { icon: 'text-purple-600', border: 'border-purple-300', bg: 'bg-purple-50', button: 'bg-purple-600 hover:bg-purple-700' }
  };
  const cls = colorClasses[color];

  const validarTextoSinNumeros = (texto: string): boolean => {
    return !/\d/.test(texto);
  };

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    if (validarTextoSinNumeros(valor)) {
      setDatos({...datos, nombres: formatText(valor)});
    }
  };

  const handleApellidoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    if (validarTextoSinNumeros(valor)) {
      setDatos({...datos, apellidos: formatText(valor)});
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${esRepresentanteLegal ? `${cls.border} ${cls.bg}` : 'border-slate-200'}`}>
      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <FaUser className={cls.icon} /> 
        {titulo}
        {esRepresentanteLegal && (
          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded ml-2">Representante Legal</span>
        )}
      </h3>

      {/* Fila 1: Cédula con buscador */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={cedula}
          onChange={(e) => setCedula(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="Cédula de identidad (10 dígitos) *"
          className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
          maxLength={10}
          required
          disabled={buscando}
        />
        <button
          type="button"
          onClick={() => onBuscar(tipo, cedula)}
          disabled={buscando || cedula.length < 10}
          className={`${cls.button} text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {buscando ? (
            <>
              <FaSpinner className="animate-spin" />
              <span className="hidden sm:inline">Buscando...</span>
            </>
          ) : (
            <>
              <FaSearch />
              <span className="hidden sm:inline">Buscar</span>
            </>
          )}
        </button>
      </div>

      {/* Fila 2: Nombres y Apellidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Nombres *</label>
          <input 
            type="text" 
            value={datos.nombres || ''} 
            onChange={handleNombreChange}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase" 
            placeholder="SOLO LETRAS"
            required 
          />
          {!validarTextoSinNumeros(datos.nombres || '') && (
            <p className="text-xs text-red-600 mt-1">Los nombres no pueden contener números</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Apellidos *</label>
          <input 
            type="text" 
            value={datos.apellidos || ''} 
            onChange={handleApellidoChange}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase" 
            placeholder="SOLO LETRAS"
            required 
          />
          {!validarTextoSinNumeros(datos.apellidos || '') && (
            <p className="text-xs text-red-600 mt-1">Los apellidos no pueden contener números</p>
          )}
        </div>
      </div>

      {/* Fila 3: Estado Civil e Instrucción */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Estado Civil</label>
          <select 
            value={datos.estadoCivil || 'Soltero(a)'} 
            onChange={(e) => setDatos({...datos, estadoCivil: e.target.value})} 
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="Soltero(a)">Soltero(a)</option>
            <option value="Casado(a)">Casado(a)</option>
            <option value="Divorciado(a)">Divorciado(a)</option>
            <option value="Viudo(a)">Viudo(a)</option>
            <option value="Unión Libre">Unión Libre</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Instrucción</label>
          <select 
            value={datos.instruccion || 'Superior'} 
            onChange={(e) => setDatos({...datos, instruccion: e.target.value})} 
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="Ninguna">Ninguna</option>
            <option value="Primaria">Primaria</option>
            <option value="Secundaria">Secundaria</option>
            <option value="Superior">Superior</option>
            <option value="Postgrado">Postgrado</option>
          </select>
        </div>
      </div>

      {/* Fila 4: Profesión y Lugar de Trabajo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Profesión / Ocupación</label>
          <input 
            type="text" 
            value={datos.profesion || ''} 
            onChange={(e) => setDatos({...datos, profesion: formatText(e.target.value)})} 
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase" 
            placeholder="EJ: INGENIERA, COMERCIANTE"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Lugar de Trabajo</label>
          <input 
            type="text" 
            value={datos.lugarTrabajo || ''} 
            onChange={(e) => setDatos({...datos, lugarTrabajo: formatText(e.target.value)})} 
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase" 
            placeholder="EJ: EMPRESA X, CASA"
          />
        </div>
      </div>

      {/* Fila 5: Celular y Correo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Celular *</label>
          <div className="flex items-center gap-2">
            <FaPhoneAlt className="text-slate-400 text-sm" />
            <input 
              type="text" 
              value={datos.telefonos?.[0] || ''} 
              onChange={(e) => setDatos({...datos, telefonos: [e.target.value.replace(/\D/g, '').slice(0, 10)]})} 
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" 
              placeholder="Ej: 0991234567"
              maxLength={10}
              required 
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Correo Electrónico</label>
          <div className="flex items-center gap-2">
            <FaEnvelope className="text-slate-400 text-sm" />
            <input 
              type="email" 
              value={datos.email || ''} 
              onChange={(e) => setDatos({...datos, email: e.target.value.toLowerCase()})} 
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" 
              placeholder="ejemplo@correo.com"
            />
          </div>
        </div>
      </div>

      {/* Campo de parentesco solo para "Otro" */}
      {tipo === 'otro' && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-700 mb-1">Parentesco / Relación *</label>
          <select 
            value={datos.parentesco || ''} 
            onChange={(e) => setDatos({...datos, parentesco: e.target.value})} 
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            required
          >
            <option value="">Seleccione...</option>
            <option value="Abuela/o">Abuela/o</option>
            <option value="Tía/o">Tía/o</option>
            <option value="Hermano/a Mayor">Hermano/a Mayor</option>
            <option value="Representante Legal">Representante Legal</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
      )}
    </div>
  );
};

// ✅ Componente principal
export default function Matricula() {
  const [step, setStep] = useState(1);
  const [gradosDisponibles, setGradosDisponibles] = useState<Grado[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [codigoSeguimiento, setCodigoSeguimiento] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // ✅ Estados de carga para cada botón de búsqueda
  const [buscandoMadre, setBuscandoMadre] = useState(false);
  const [buscandoPadre, setBuscandoPadre] = useState(false);
  const [buscandoOtro, setBuscandoOtro] = useState(false);
  const [buscandoEstudiante, setBuscandoEstudiante] = useState(false);

  // Estados del formulario
  const [tipoMatricula, setTipoMatricula] = useState<'renovacion' | 'nuevo'>('nuevo');
  
  // Configuración familiar
  const [representanteLegal, setRepresentanteLegal] = useState<'madre' | 'padre' | 'otro'>('madre');
  const [viveCon, setViveCon] = useState({
    madre: false,
    padre: false,
    abuelos: false,
    tios: false,
    hermanos: false,
    otros: false,
    otrosDetalle: ''
  });

  // Datos de la Madre
  const [cedulaMadre, setCedulaMadre] = useState('');
  const [madre, setMadre] = useState<Partial<Representante>>({
    parentesco: 'Madre',
    telefonos: [''],
    estadoCivil: 'Soltero(a)',
    instruccion: 'Superior',
    profesion: '',
    lugarTrabajo: '',
    email: ''
  });

  // Datos del Padre
  const [cedulaPadre, setCedulaPadre] = useState('');
  const [padre, setPadre] = useState<Partial<Representante>>({
    parentesco: 'Padre',
    telefonos: [''],
    estadoCivil: 'Soltero(a)',
    instruccion: 'Superior',
    profesion: '',
    lugarTrabajo: '',
    email: ''
  });

  // Datos del Representante Legal (si no es padre ni madre)
  const [cedulaOtroRep, setCedulaOtroRep] = useState('');
  const [otroRepresentante, setOtroRepresentante] = useState<Partial<Representante>>({
    parentesco: 'Representante Legal',
    telefonos: [''],
    estadoCivil: 'Soltero(a)',
    instruccion: 'Superior',
    profesion: '',
    lugarTrabajo: '',
    email: ''
  });

  const [estudiante, setEstudiante] = useState({
    cedula: '',
    apellidos: '',
    nombres: '',
    fechaNacimiento: '',
    sexo: 'M' as 'M' | 'F',
    nacionalidad: 'Ecuatoriana',
    edad: '',
    etnia: 'Mestizo',
    direccion: '',
    celular: ''
  });

  const [gradoSolicitado, setGradoSolicitado] = useState('');

  const [ficha, setFicha] = useState<FichaMatricula>({
    convivencia: { viveCon: [], totalPersonas: 1, numeroHermanos: 0, ordenEntreHermanos: 1 },
    vivienda: { condicion: 'Propia', tipo: 'Casa', servicios: [] },
    salud: { tieneDiscapacidad: false, discapacidades: [], condicionMedica: '', alergias: '', medicamentos: '', atencionMedica: 'Centro de salud' },
    academicoPrevio: { institucionProcedencia: '', repitioAnios: false, aniosRepitidos: '' }
  });

  // Cargar grados abiertos a matrícula
  useEffect(() => {
    const cargarGrados = async () => {
      try {
        const q = query(
          collection(db, 'grados'),
          where('activo', '==', true),
          where('abiertoMatricula', '==', true)
        );
        const snap = await getDocs(q);
        // ✅ CORRECCIÓN 1: Ordenar los grados por el campo 'orden' para que aparezcan en secuencia lógica
        const data = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Grado))
          .sort((a, b) => a.orden - b.orden);
        
        setGradosDisponibles(data);
      } catch (error) {
        console.error('Error cargando grados:', error);
      } finally {
        setLoading(false);
      }
    };
    cargarGrados();
  }, []);

  // Calcular edad en el onChange
  const handleFechaNacimientoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fecha = e.target.value;
    let edadCalculada = '';
    
    if (fecha) {
      const hoy = new Date();
      const nacimiento = new Date(fecha);
      let edad = hoy.getFullYear() - nacimiento.getFullYear();
      const mesDiff = hoy.getMonth() - nacimiento.getMonth();
      if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
      }
      edadCalculada = edad.toString();
    }
    
    setEstudiante(prev => ({ ...prev, fechaNacimiento: fecha, edad: edadCalculada }));
  };

  // ✅ Buscar representante por cédula con estado de carga
  const buscarRepresentante = useCallback(async (tipo: 'madre' | 'padre' | 'otro', cedula: string) => {
    if (cedula.length < 10) return;
    
    if (tipo === 'madre') setBuscandoMadre(true);
    else if (tipo === 'padre') setBuscandoPadre(true);
    else setBuscandoOtro(true);

    try {
      const q = query(collection(db, 'representantes'), where('cedula', '==', cedula.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data() as Representante;
        if (tipo === 'madre') {
          setMadre({ id: snap.docs[0].id, ...data });
        } else if (tipo === 'padre') {
          setPadre({ id: snap.docs[0].id, ...data });
        } else {
          setOtroRepresentante({ id: snap.docs[0].id, ...data });
        }
      } else {
        const nuevoRep = { cedula: cedula, telefonos: [''], estadoCivil: 'Soltero(a)', instruccion: 'Superior', profesion: '', lugarTrabajo: '', email: '' };
        if (tipo === 'madre') {
          setMadre({ ...nuevoRep, parentesco: 'Madre' });
        } else if (tipo === 'padre') {
          setPadre({ ...nuevoRep, parentesco: 'Padre' });
        } else {
          setOtroRepresentante({ ...nuevoRep, parentesco: 'Representante Legal' });
        }
      }
    } catch (error) {
      console.error('Error buscando representante:', error);
    } finally {
      if (tipo === 'madre') setBuscandoMadre(false);
      else if (tipo === 'padre') setBuscandoPadre(false);
      else setBuscandoOtro(false);
    }
  }, []);

  // ✅ Buscar estudiante por cédula con estado de carga (para renovaciones)
  const buscarEstudiante = useCallback(async (cedula: string) => {
    if (cedula.length < 10) return;
    setBuscandoEstudiante(true);
    try {
      const q = query(collection(db, 'estudiantes'), where('cedula', '==', cedula.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        interface EstudianteData {
          cedula?: string;
          apellidos?: string;
          nombres?: string;
          fechaNacimiento?: string;
          sexo?: 'M' | 'F';
          nacionalidad?: string;
          edad?: string | number;
          etnia?: string;
          direccion?: string;
          celular?: string;
        }
        const data = snap.docs[0].data() as EstudianteData;
        
        let edadCalculada = '';
        if (data.fechaNacimiento) {
          const hoy = new Date();
          const nacimiento = new Date(data.fechaNacimiento);
          let edad = hoy.getFullYear() - nacimiento.getFullYear();
          const mesDiff = hoy.getMonth() - nacimiento.getMonth();
          if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < nacimiento.getDate())) {
            edad--;
          }
          edadCalculada = edad.toString();
        }
        setEstudiante({
          cedula: data.cedula || cedula,
          apellidos: data.apellidos || '',
          nombres: data.nombres || '',
          fechaNacimiento: data.fechaNacimiento || '',
          sexo: data.sexo || 'M',
          nacionalidad: data.nacionalidad || 'Ecuatoriana',
          edad: edadCalculada,
          etnia: data.etnia || 'Mestizo',
          direccion: data.direccion || '',
          celular: data.celular || ''
        });
      } else {
        setEstudiante({
          cedula,
          apellidos: '',
          nombres: '',
          fechaNacimiento: '',
          sexo: 'M',
          nacionalidad: 'Ecuatoriana',
          edad: '',
          etnia: 'Mestizo',
          direccion: '',
          celular: ''
        });
      }
    } catch (error) {
      console.error('Error buscando estudiante:', error);
    } finally {
      setBuscandoEstudiante(false);
    }
  }, []);

  // ✅ VALIDACIÓN DEL PASO 2
  const validarPaso2 = (): boolean => {
    const errores: string[] = [];

    const viveConSeleccionado = Object.values(viveCon).some(valor => valor === true);
    if (!viveConSeleccionado) {
      errores.push('Debe seleccionar al menos una opción en "¿Con quién vive el estudiante?"');
    }

    if (viveCon.otros && representanteLegal !== 'otro') {
      errores.push('Si el estudiante vive con "Otros", el representante legal debe ser "Otro"');
    }

    const validarRepresentante = (cedula: string, datos: Partial<Representante>, nombre: string) => {
      if (!cedula || cedula.length !== 10 || !/^\d+$/.test(cedula)) {
        errores.push(`La cédula de ${nombre} debe tener 10 dígitos numéricos`);
      }
      if (!datos.nombres || datos.nombres.trim() === '' || /\d/.test(datos.nombres)) {
        errores.push(`Los nombres de ${nombre} son requeridos y solo pueden contener letras`);
      }
      if (!datos.apellidos || datos.apellidos.trim() === '' || /\d/.test(datos.apellidos)) {
        errores.push(`Los apellidos de ${nombre} son requeridos y solo pueden contener letras`);
      }
      const celular = datos.telefonos?.[0] || '';
      if (!celular || celular.length !== 10 || !/^\d+$/.test(celular)) {
        errores.push(`El celular de ${nombre} debe tener 10 dígitos numéricos`);
      }
    };

    if (representanteLegal === 'madre' && (viveCon.madre || representanteLegal === 'madre')) {
      validarRepresentante(cedulaMadre, madre, 'la Madre');
    }

    if (representanteLegal === 'padre' && (viveCon.padre || representanteLegal === 'padre')) {
      validarRepresentante(cedulaPadre, padre, 'el Padre');
    }

    if (representanteLegal === 'otro') {
      validarRepresentante(cedulaOtroRep, otroRepresentante, 'el Representante Legal');
      if (viveCon.otros && !viveCon.otrosDetalle.trim()) {
        errores.push('Debe especificar con quién vive el estudiante en el campo "Otros"');
      }
    }

    if (viveCon.padre && representanteLegal !== 'padre') {
      if (cedulaPadre || padre.nombres || padre.apellidos || padre.telefonos?.[0]) {
        validarRepresentante(cedulaPadre, padre, 'el Padre');
      }
    }

    if (viveCon.madre && representanteLegal !== 'madre') {
      if (cedulaMadre || madre.nombres || madre.apellidos || madre.telefonos?.[0]) {
        validarRepresentante(cedulaMadre, madre, 'la Madre');
      }
    }

    setValidationErrors(errores);
    return errores.length === 0;
  };

  // ✅ VALIDACIÓN DEL PASO 3
  const validarPaso3 = (): boolean => {
    const errores: string[] = [];
    if (!estudiante.cedula || estudiante.cedula.length !== 10) errores.push('La cédula del estudiante debe tener 10 dígitos numéricos');
    if (!estudiante.nombres || estudiante.nombres.trim() === '') errores.push('Los nombres del estudiante son requeridos');
    if (!estudiante.apellidos || estudiante.apellidos.trim() === '') errores.push('Los apellidos del estudiante son requeridos');
    if (!estudiante.fechaNacimiento) errores.push('La fecha de nacimiento es requerida');
    if (!estudiante.direccion || estudiante.direccion.trim() === '') errores.push('La dirección de domicilio es requerida');
    if (!gradoSolicitado) errores.push('Debe seleccionar un grado al que aspira');

    setValidationErrors(errores);
    return errores.length === 0;
  };

  const handleNextStep = () => {
    if (step === 2) {
      if (validarPaso2()) {
        setStep(step + 1);
        setValidationErrors([]);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (step === 3) {
      if (validarPaso3()) {
        setStep(step + 1);
        setValidationErrors([]);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      setStep(step + 1);
    }
  };

  const generarCodigo = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `MAT-${year}-${random}`;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let repPrincipalId = '';

      if (representanteLegal === 'madre') {
        const repMadre = madre as Representante;
        if (!repMadre.id) {
          const nuevoRep: Partial<Representante> = { ...madre, cedula: cedulaMadre, createdAt: new Date().toISOString() };
          const docRef = await addDoc(collection(db, 'representantes'), nuevoRep);
          repPrincipalId = docRef.id;
        } else {
          repPrincipalId = repMadre.id;
        }
      } else if (representanteLegal === 'padre') {
        const repPadre = padre as Representante;
        if (!repPadre.id) {
          const nuevoRep: Partial<Representante> = { ...padre, cedula: cedulaPadre, createdAt: new Date().toISOString() };
          const docRef = await addDoc(collection(db, 'representantes'), nuevoRep);
          repPrincipalId = docRef.id;
        } else {
          repPrincipalId = repPadre.id;
        }
      } else {
        const repOtro = otroRepresentante as Representante;
        if (!repOtro.id) {
          const nuevoRep: Partial<Representante> = { ...otroRepresentante, cedula: cedulaOtroRep, createdAt: new Date().toISOString() };
          const docRef = await addDoc(collection(db, 'representantes'), nuevoRep);
          repPrincipalId = docRef.id;
        } else {
          repPrincipalId = repOtro.id;
        }
      }

      if (representanteLegal !== 'madre' && cedulaMadre && madre.nombres) {
        const repMadre = madre as Representante;
        if (!repMadre.id) {
          await addDoc(collection(db, 'representantes'), { ...madre, cedula: cedulaMadre, createdAt: new Date().toISOString() });
        }
      }
      if (representanteLegal !== 'padre' && cedulaPadre && padre.nombres) {
        const repPadre = padre as Representante;
        if (!repPadre.id) {
          await addDoc(collection(db, 'representantes'), { ...padre, cedula: cedulaPadre, createdAt: new Date().toISOString() });
        }
      }

      const codigo = generarCodigo();
      const solicitud: Omit<SolicitudMatricula, 'id'> = {
        tipo: tipoMatricula,
        estado: 'pendiente',
        fechaSolicitud: new Date().toISOString(),
        codigoSeguimiento: codigo,
        representantePrincipalId: repPrincipalId,
        estudiante: {
          cedula: estudiante.cedula,
          nombres: estudiante.nombres,
          apellidos: estudiante.apellidos,
          fechaNacimiento: estudiante.fechaNacimiento,
          sexo: estudiante.sexo,
          nacionalidad: estudiante.nacionalidad,
          edad: parseInt(estudiante.edad) || 0,
          etnia: estudiante.etnia,
          direccion: estudiante.direccion,
          celular: estudiante.celular
        },
        gradoSolicitado,
        fichaMatricula: ficha,
        whatsappEnviado: false
      };

      await addDoc(collection(db, 'solicitudesMatriculas'), {
        ...solicitud,
        fechaSolicitud: serverTimestamp()
      });

      setCodigoSeguimiento(codigo);
      setSuccess(true);
    } catch (error) {
      console.error('Error guardando matrícula:', error);
      alert('Hubo un error al enviar la solicitud. Por favor, inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleServicio = (servicio: string) => {
    const servicios = ficha.vivienda.servicios;
    const nuevosServicios = servicios.includes(servicio)
      ? servicios.filter(s => s !== servicio)
      : [...servicios, servicio];
    setFicha({ ...ficha, vivienda: { ...ficha.vivienda, servicios: nuevosServicios } });
  };

  const toggleConvive = (persona: string) => {
    const viveCon = ficha.convivencia.viveCon;
    const nuevos = viveCon.includes(persona)
      ? viveCon.filter(p => p !== persona)
      : [...viveCon, persona];
    setFicha({ ...ficha, convivencia: { ...ficha.convivencia, viveCon: nuevos } });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-600 font-medium">Cargando formulario...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8 text-center border-t-4 border-green-500">
          <FaCheckCircle className="text-6xl text-green-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-slate-900 mb-2">¡Solicitud Registrada!</h2>
          <p className="text-slate-600 mb-6">Tu código de seguimiento es:</p>
          <div className="bg-slate-100 rounded-lg p-4 mb-6">
            <span className="text-3xl font-mono font-bold text-blue-700 tracking-wider">{codigoSeguimiento}</span>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-left">
            <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
              <FaSchool className="text-blue-600" />
              {tipoMatricula === 'renovacion' ? 'Próximos pasos (Renovación):' : 'Próximos pasos (Nuevo Ingreso):'}
            </h3>
            <p className="text-blue-800 text-sm leading-relaxed">
              {tipoMatricula === 'renovacion' 
                ? 'Su actualización de matrícula fue recibida favorablemente. Por favor, acérquese a la institución educativa dentro de los próximos 5 días hábiles para firmar los documentos oficiales.'
                : 'Su solicitud de matrícula será revisada por el departamento de admisiones. Recibirá una respuesta en un plazo de 48-72 horas hábiles.'}
            </p>
            <p className="text-blue-800 text-sm mt-3 font-semibold flex items-center gap-2">
              📱 Se enviará un mensaje de confirmación por WhatsApp al número registrado.
            </p>
          </div>
          <button onClick={() => window.location.href = '/'} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-all">
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Ficha de Matrícula 2025-2026</h1>
          <p className="text-slate-600 mt-2">Complete el formulario para registrar la solicitud de matrícula.</p>
        </div>

        <div className="flex justify-between mb-8 relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-10 transform -translate-y-1/2"></div>
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`flex flex-col items-center ${step >= s ? 'text-blue-600' : 'text-slate-400'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 ${step >= s ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}>
                {s}
              </div>
              <span className="text-xs font-semibold mt-2 hidden sm:block">
                {s === 1 ? 'Tipo' : s === 2 ? 'Familia' : s === 3 ? 'Estudiante' : 'Ficha'}
              </span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          {/* Mostrar errores de validación */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <FaExclamationCircle className="text-red-600 mt-0.5 text-xl" />
                <div>
                  <h4 className="text-red-800 font-semibold mb-2">
                    {validationErrors.length} error{validationErrors.length !== 1 ? 'es' : ''} encontrado{validationErrors.length !== 1 ? 's' : ''}:
                  </h4>
                  <ul className="text-red-700 text-sm space-y-1">
                    {validationErrors.map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* PASO 1: Tipo de Matrícula */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FaSchool className="text-blue-600" /> Tipo de Matrícula
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setTipoMatricula('renovacion')}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${tipoMatricula === 'renovacion' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <div className="font-bold text-lg mb-1">Renovación</div>
                  <div className="text-sm text-slate-600">El estudiante ya pertenece a la institución.</div>
                </button>
                <button
                  onClick={() => setTipoMatricula('nuevo')}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${tipoMatricula === 'nuevo' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <div className="font-bold text-lg mb-1">Nuevo Ingreso</div>
                  <div className="text-sm text-slate-600">El estudiante viene de otra institución educativa.</div>
                </button>
              </div>
            </div>
          )}

          {/* PASO 2: Datos Familiares */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FaUser className="text-blue-600" /> Datos Familiares
              </h2>

              {/* ¿Con quién vive el estudiante? */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  ¿Con quién vive el estudiante? *
                </label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={viveCon.madre}
                      disabled={viveCon.otros}
                      onChange={(e) => setViveCon({ ...viveCon, madre: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded disabled:opacity-50"
                    />
                    <span className="text-sm">Madre</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={viveCon.padre}
                      disabled={viveCon.otros}
                      onChange={(e) => setViveCon({ ...viveCon, padre: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded disabled:opacity-50"
                    />
                    <span className="text-sm">Padre</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={viveCon.otros}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setViveCon({
                            ...viveCon,
                            otros: true,
                            madre: false,
                            padre: false,
                            abuelos: false,
                            tios: false,
                            hermanos: false,
                            otrosDetalle: ''
                          });
                          setRepresentanteLegal('otro');
                        } else {
                          setViveCon({ ...viveCon, otros: false });
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">Otros (No vive con padre ni madre)</span>
                  </label>
                </div>
                {viveCon.otros && (
                  <div className="mt-3">
                    <input
                      type="text"
                      placeholder="Especifique con quién vive (ej: tía, abuelos, hermano mayor, etc.) *"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 uppercase"
                      value={viveCon.otrosDetalle}
                      onChange={(e) => setViveCon({ ...viveCon, otrosDetalle: formatText(e.target.value) })}
                      required
                    />
                  </div>
                )}
              </div>

              {/* ¿Quién es el representante legal? */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  ¿Quién es el representante legal del estudiante? *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => !viveCon.otros && setRepresentanteLegal('madre')}
                    disabled={viveCon.otros}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      representanteLegal === 'madre' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                    } ${viveCon.otros ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="font-semibold text-sm">Madre</div>
                    <div className="text-xs text-slate-600">Representante legal</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => !viveCon.otros && setRepresentanteLegal('padre')}
                    disabled={viveCon.otros}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      representanteLegal === 'padre' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                    } ${viveCon.otros ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="font-semibold text-sm">Padre</div>
                    <div className="text-xs text-slate-600">Representante legal</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepresentanteLegal('otro')}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      representanteLegal === 'otro' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="font-semibold text-sm">Otro</div>
                    <div className="text-xs text-slate-600">Tío, abuelo, etc.</div>
                  </button>
                </div>
                {viveCon.otros && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <FaExclamationCircle /> Al vivir con "Otros", el representante legal debe ser "Otro"
                  </p>
                )}
              </div>

              {/* Formulario de la Madre */}
              {(viveCon.madre || representanteLegal === 'madre') && !viveCon.otros && (
                <FormularioRepresentante
                  tipo="madre"
                  cedula={cedulaMadre}
                  setCedula={setCedulaMadre}
                  datos={madre}
                  setDatos={setMadre}
                  color="pink"
                  esRepresentanteLegal={representanteLegal === 'madre'}
                  titulo="Datos de la Madre"
                  onBuscar={buscarRepresentante}
                  buscando={buscandoMadre}
                />
              )}

              {/* Formulario del Padre */}
              {(viveCon.padre || representanteLegal === 'padre') && !viveCon.otros && (
                <FormularioRepresentante
                  tipo="padre"
                  cedula={cedulaPadre}
                  setCedula={setCedulaPadre}
                  datos={padre}
                  setDatos={setPadre}
                  color="indigo"
                  esRepresentanteLegal={representanteLegal === 'padre'}
                  titulo="Datos del Padre"
                  onBuscar={buscarRepresentante}
                  buscando={buscandoPadre}
                />
              )}

              {/* Formulario de Otro Representante */}
              {representanteLegal === 'otro' && (
                <FormularioRepresentante
                  tipo="otro"
                  cedula={cedulaOtroRep}
                  setCedula={setCedulaOtroRep}
                  datos={otroRepresentante}
                  setDatos={setOtroRepresentante}
                  color="purple"
                  esRepresentanteLegal={true}
                  titulo="Datos del Representante Legal"
                  onBuscar={buscarRepresentante}
                  buscando={buscandoOtro}
                />
              )}
            </div>
          )}

          {/* ✅ PASO 3: Datos del Estudiante (Rediseñado como panel) */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FaSchool className="text-blue-600" /> Datos del Estudiante
              </h2>

              {/* Panel encapsulado con borde y fondo */}
              <div className="border rounded-lg p-4 border-slate-200 bg-slate-50">
                {/* Fila 1: Cédula con buscador */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={estudiante.cedula}
                    onChange={(e) => setEstudiante({ ...estudiante, cedula: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="Cédula de identidad (10 dígitos) *"
                    className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    maxLength={10}
                    required
                    disabled={buscandoEstudiante}
                  />
                  <button
                    type="button"
                    onClick={() => buscarEstudiante(estudiante.cedula)}
                    disabled={buscandoEstudiante || estudiante.cedula.length < 10}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {buscandoEstudiante ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        <span className="hidden sm:inline">Buscando...</span>
                      </>
                    ) : (
                      <>
                        <FaSearch />
                        <span className="hidden sm:inline">Buscar</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Fila 2: Nombres y Apellidos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Nombres *</label>
                    <input
                      type="text"
                      value={estudiante.nombres}
                      onChange={(e) => setEstudiante({ ...estudiante, nombres: formatText(e.target.value) })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase"
                      placeholder="SOLO LETRAS"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Apellidos *</label>
                    <input
                      type="text"
                      value={estudiante.apellidos}
                      onChange={(e) => setEstudiante({ ...estudiante, apellidos: formatText(e.target.value) })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase"
                      placeholder="SOLO LETRAS"
                      required
                    />
                  </div>
                </div>

                {/* Fila 3: Fecha de Nacimiento y Edad */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Fecha de Nacimiento *</label>
                    <input
                      type="date"
                      value={estudiante.fechaNacimiento}
                      onChange={handleFechaNacimientoChange}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Edad (años)</label>
                    <input
                      type="number"
                      value={estudiante.edad}
                      readOnly
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-100"
                    />
                  </div>
                </div>

                {/* Fila 4: Sexo, Nacionalidad y Etnia */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Sexo *</label>
                    <select
                      value={estudiante.sexo}
                      onChange={(e) => setEstudiante({ ...estudiante, sexo: e.target.value as 'M' | 'F' })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      required
                    >
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Nacionalidad *</label>
                    <input
                      type="text"
                      value={estudiante.nacionalidad}
                      onChange={(e) => setEstudiante({ ...estudiante, nacionalidad: formatText(e.target.value) })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase"
                      placeholder="EJ: ECUATORIANA"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Etnia *</label>
                    <select
                      value={estudiante.etnia}
                      onChange={(e) => setEstudiante({ ...estudiante, etnia: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      required
                    >
                      <option value="Mestizo">Mestizo</option>
                      <option value="Indígena">Indígena</option>
                      <option value="Afroecuatoriano">Afroecuatoriano</option>
                      <option value="Blanco">Blanco</option>
                      <option value="Montubio">Montubio</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                </div>

                {/* Fila 5: Dirección y Celular */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Dirección de Domicilio *</label>
                    <div className="flex items-center gap-2">
                      <FaMapMarkerAlt className="text-slate-400" />
                      <input
                        type="text"
                        value={estudiante.direccion}
                        onChange={(e) => setEstudiante({ ...estudiante, direccion: formatText(e.target.value) })}
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase"
                        placeholder="CALLE, AVENIDA, SECTOR, REFERENCIA..."
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Celular</label>
                    <div className="flex items-center gap-2">
                      <FaPhoneAlt className="text-slate-400" />
                      <input
                        type="text"
                        value={estudiante.celular}
                        onChange={(e) => setEstudiante({ ...estudiante, celular: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Ej: 0991234567"
                        maxLength={10}
                      />
                    </div>
                  </div>
                </div>

                {/* ✅ Fila 6: Grado al que aspira (Ordenado) */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Grado al que aspira *</label>
                  <select
                    value={gradoSolicitado}
                    onChange={(e) => setGradoSolicitado(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Seleccione un grado...</option>
                    {gradosDisponibles.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre} - {g.paralelo}
                      </option>
                    ))}
                  </select>
                  {gradosDisponibles.length === 0 && (
                    <p className="text-red-500 text-xs mt-1">No hay grados disponibles para matrícula en este momento.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PASO 4: Ficha Complementaria */}
          {step === 4 && (
            <div className="space-y-8">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FaHeartbeat className="text-blue-600" /> Ficha Complementaria
              </h2>

              {/* 1. Convivencia Familiar */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-semibold text-slate-800 mb-1">1. Convivencia Familiar</h3>
                <p className="text-sm text-slate-600 mb-3">Personas con quien vive el estudiante bajo el mismo techo.</p>
                <div className="flex flex-wrap gap-3 mb-3">
                  {['Madre', 'Padre', 'Hermanos', 'Abuelos', 'Tíos', 'Otros'].map(p => {
                    const seleccionadoPaso2 = 
                      (p === 'Madre' && (viveCon.madre || representanteLegal === 'madre')) ||
                      (p === 'Padre' && (viveCon.padre || representanteLegal === 'padre')) ||
                      (p === 'Otros' && viveCon.otros);
                    
                    const esDelPaso2 = p === 'Madre' || p === 'Padre' || p === 'Otros';
                    
                    return (
                      <label key={p} className={`flex items-center gap-2 cursor-pointer ${esDelPaso2 ? 'opacity-75' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={ficha.convivencia.viveCon.includes(p) || seleccionadoPaso2} 
                          disabled={esDelPaso2}
                          onChange={() => toggleConvive(p)} 
                          className="rounded text-blue-600 disabled:cursor-not-allowed" 
                        />
                        <span className="text-sm">{p}{esDelPaso2 ? ' (Paso 2)' : ''}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Total personas en casa</label>
                    <input 
                      type="number" 
                      value={ficha.convivencia.totalPersonas} 
                      onChange={(e) => setFicha({...ficha, convivencia: {...ficha.convivencia, totalPersonas: Number(e.target.value)}})} 
                      className="w-full border rounded px-2 py-1" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">N° de hermanos</label>
                    <input 
                      type="number" 
                      value={ficha.convivencia.numeroHermanos} 
                      onChange={(e) => setFicha({...ficha, convivencia: {...ficha.convivencia, numeroHermanos: Number(e.target.value)}})} 
                      className="w-full border rounded px-2 py-1" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Orden entre hermanos</label>
                    <input 
                      type="number" 
                      value={ficha.convivencia.ordenEntreHermanos} 
                      onChange={(e) => setFicha({...ficha, convivencia: {...ficha.convivencia, ordenEntreHermanos: Number(e.target.value)}})} 
                      className="w-full border rounded px-2 py-1" 
                    />
                  </div>
                </div>
              </div>

              {/* 2. Vivienda */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <FaHome className="text-slate-500"/> 2. Vivienda
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Condición</label>
                    <select 
                      value={ficha.vivienda.condicion} 
                      onChange={(e) => setFicha({...ficha, vivienda: {...ficha.vivienda, condicion: e.target.value as FichaMatricula['vivienda']['condicion']}})} 
                      className="w-full border rounded px-2 py-1"
                    >
                      {['Propia', 'Arrendada', 'Anticresis', 'Prestada', 'Compartida', 'Con préstamo', 'Otra'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Tipo</label>
                    <select 
                      value={ficha.vivienda.tipo} 
                      onChange={(e) => setFicha({...ficha, vivienda: {...ficha.vivienda, tipo: e.target.value as FichaMatricula['vivienda']['tipo']}})} 
                      className="w-full border rounded px-2 py-1"
                    >
                      {['Casa', 'Departamento', 'Cuarto', 'Otro'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span className="text-sm font-medium w-full mb-1">Servicios básicos:</span>
                  {[
                    'Luz eléctrica', 
                    'Agua potable', 
                    'SSHH',
                    'Pozo séptico',
                    'Internet', 
                    'Computador/Laptop',
                    'Celular', 
                    'Tablet'
                  ].map(s => (
                    <label key={s} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={ficha.vivienda.servicios.includes(s)} 
                        onChange={() => toggleServicio(s)} 
                        className="rounded text-blue-600" 
                      />
                      <span className="text-sm">{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 3. Salud */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <FaHeartbeat className="text-red-500"/> 3. Salud
                </h3>
                
                {/* Discapacidad */}
                <div className="mb-4 border-b border-slate-200 pb-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-2">
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Discapacidad</label>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-1">
                          <input 
                            type="checkbox" 
                            checked={ficha.salud.tieneDiscapacidad} 
                            onChange={(e) => setFicha({...ficha, salud: {...ficha.salud, tieneDiscapacidad: e.target.checked}})} 
                            className="rounded text-blue-600" 
                          />
                          <span className="text-sm">SI</span>
                        </label>
                        <label className="flex items-center gap-1">
                          <input 
                            type="checkbox" 
                            checked={!ficha.salud.tieneDiscapacidad} 
                            onChange={(e) => setFicha({...ficha, salud: {...ficha.salud, tieneDiscapacidad: !e.target.checked}})} 
                            className="rounded text-blue-600" 
                          />
                          <span className="text-sm">NO</span>
                        </label>
                      </div>
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-xs text-slate-600 mb-1">Tipo</label>
                      <input 
                        type="text" 
                        value={ficha.salud.discapacidades?.[0]?.tipo || ''} 
                        onChange={(e) => {
                          const nuevasDiscapacidades = ficha.salud.discapacidades && ficha.salud.discapacidades.length > 0 
                            ? [{...ficha.salud.discapacidades[0], tipo: e.target.value}]
                            : [{tipo: e.target.value, porcentaje: '', nConadis: ''}];
                          setFicha({...ficha, salud: {...ficha.salud, discapacidades: nuevasDiscapacidades}});
                        }}
                        className="w-full border rounded px-2 py-1 text-sm" 
                        placeholder="Tipo"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-xs text-slate-600 mb-1">Porcentaje</label>
                      <input 
                        type="text" 
                        value={ficha.salud.discapacidades?.[0]?.porcentaje || ''} 
                        onChange={(e) => {
                          const nuevasDiscapacidades = ficha.salud.discapacidades && ficha.salud.discapacidades.length > 0 
                            ? [{...ficha.salud.discapacidades[0], porcentaje: e.target.value}]
                            : [{tipo: '', porcentaje: e.target.value, nConadis: ''}];
                          setFicha({...ficha, salud: {...ficha.salud, discapacidades: nuevasDiscapacidades}});
                        }}
                        className="w-full border rounded px-2 py-1 text-sm" 
                        placeholder="%"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-xs text-slate-600 mb-1">N° CONADIS</label>
                      <input 
                        type="text" 
                        value={ficha.salud.discapacidades?.[0]?.nConadis || ''} 
                        onChange={(e) => {
                          const nuevasDiscapacidades = ficha.salud.discapacidades && ficha.salud.discapacidades.length > 0 
                            ? [{...ficha.salud.discapacidades[0], nConadis: e.target.value}]
                            : [{tipo: '', porcentaje: '', nConadis: e.target.value}];
                          setFicha({...ficha, salud: {...ficha.salud, discapacidades: nuevasDiscapacidades}});
                        }}
                        className="w-full border rounded px-2 py-1 text-sm" 
                        placeholder="N°"
                      />
                    </div>
                  </div>
                </div>

                {/* Condición médica */}
                <div className="mb-3 border-b border-slate-200 pb-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">¿Tiene alguna condición médica específica?</label>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-1">
                          <input 
                            type="checkbox" 
                            checked={!!ficha.salud.condicionMedica} 
                            onChange={(e) => setFicha({...ficha, salud: {...ficha.salud, condicionMedica: e.target.checked ? '' : ''}})} 
                            className="rounded text-blue-600" 
                          />
                          <span className="text-sm">SI</span>
                        </label>
                        <label className="flex items-center gap-1">
                          <input 
                            type="checkbox" 
                            checked={!ficha.salud.condicionMedica} 
                            onChange={() => setFicha({...ficha, salud: {...ficha.salud, condicionMedica: ''}})} 
                            className="rounded text-blue-600" 
                          />
                          <span className="text-sm">NO</span>
                        </label>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">Determine cual</label>
                      <input 
                        type="text" 
                        value={ficha.salud.condicionMedica} 
                        onChange={(e) => setFicha({...ficha, salud: {...ficha.salud, condicionMedica: e.target.value}})} 
                        className="w-full border rounded px-2 py-1 text-sm" 
                        placeholder="Especifique la condición"
                      />
                    </div>
                  </div>
                </div>

                {/* Alergias */}
                <div className="mb-3 border-b border-slate-200 pb-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">¿Padece alergias?</label>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-1">
                          <input 
                            type="checkbox" 
                            checked={!!ficha.salud.alergias} 
                            onChange={(e) => setFicha({...ficha, salud: {...ficha.salud, alergias: e.target.checked ? '' : ''}})} 
                            className="rounded text-blue-600" 
                          />
                          <span className="text-sm">SI</span>
                        </label>
                        <label className="flex items-center gap-1">
                          <input 
                            type="checkbox" 
                            checked={!ficha.salud.alergias} 
                            onChange={() => setFicha({...ficha, salud: {...ficha.salud, alergias: ''}})} 
                            className="rounded text-blue-600" 
                          />
                          <span className="text-sm">NO</span>
                        </label>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">Determine cual</label>
                      <input 
                        type="text" 
                        value={ficha.salud.alergias} 
                        onChange={(e) => setFicha({...ficha, salud: {...ficha.salud, alergias: e.target.value}})} 
                        className="w-full border rounded px-2 py-1 text-sm" 
                        placeholder="Especifique las alergias"
                      />
                    </div>
                  </div>
                </div>

                {/* Medicamentos */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Especifique los medicamentos que utiliza</label>
                  <input 
                    type="text" 
                    value={ficha.salud.medicamentos} 
                    onChange={(e) => setFicha({...ficha, salud: {...ficha.salud, medicamentos: e.target.value}})} 
                    className="w-full border rounded px-2 py-1 text-sm" 
                    placeholder="Liste los medicamentos"
                  />
                </div>

                {/* Lugar de atención médica */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">El estudiante recibe atención médica en:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      'Centro de salud',
                      'Subcentro de salud',
                      'Hospital público',
                      'Clínica privada'
                    ].map(lugar => (
                      <label key={lugar} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-slate-50">
                        <input 
                          type="radio" 
                          name="atencionMedica"
                          checked={ficha.salud.atencionMedica === lugar} 
                          onChange={() => setFicha({...ficha, salud: {...ficha.salud, atencionMedica: lugar as FichaMatricula['salud']['atencionMedica']}})} 
                          className="text-blue-600" 
                        />
                        <span className="text-sm">{lugar}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4. Datos Académicos Previos */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <FaBook className="text-green-600"/> 4. Datos Académicos Previos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-slate-600 mb-1">Institución educativa de la que procede</label>
                    <input 
                      type="text" 
                      value={ficha.academicoPrevio.institucionProcedencia} 
                      onChange={(e) => setFicha({...ficha, academicoPrevio: {...ficha.academicoPrevio, institucionProcedencia: e.target.value}})} 
                      className="w-full border rounded px-2 py-1" 
                      placeholder="Nombre del colegio o escuela anterior" 
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input 
                        type="checkbox" 
                        checked={ficha.academicoPrevio.repitioAnios} 
                        onChange={(e) => setFicha({...ficha, academicoPrevio: {...ficha.academicoPrevio, repitioAnios: e.target.checked}})} 
                        className="rounded text-blue-600" 
                      />
                      <span className="text-sm">¿Ha repetido años?</span>
                    </label>
                  </div>
                  {ficha.academicoPrevio.repitioAnios && (
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">¿Cuáles?</label>
                      <input 
                        type="text" 
                        value={ficha.academicoPrevio.aniosRepitidos} 
                        onChange={(e) => setFicha({...ficha, academicoPrevio: {...ficha.academicoPrevio, aniosRepitidos: e.target.value}})} 
                        className="w-full border rounded px-2 py-1" 
                        placeholder="Ej: 3ro EGB" 
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Botones de Navegación */}
          <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium px-4 py-2 rounded-lg hover:bg-slate-100 transition-all"
              >
                <FaArrowLeft /> Anterior
              </button>
            ) : (
              <div></div>
            )}
            {step < 4 ? (
              <button
                onClick={handleNextStep}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-all"
              >
                Siguiente <FaArrowRight />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || gradosDisponibles.length === 0}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {/* ✅ CORRECCIÓN 3: Texto dinámico según el tipo de matrícula */}
                {submitting 
                  ? 'Enviando...' 
                  : tipoMatricula === 'renovacion' 
                    ? 'Enviar Actualización de Matrícula' 
                    : 'Enviar Solicitud de Matrícula'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}