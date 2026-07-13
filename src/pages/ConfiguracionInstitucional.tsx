import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaSave, FaBuilding, FaUserTie, FaImage, FaCheck, FaTimes, FaExclamationTriangle } from 'react-icons/fa';

interface ConfiguracionInstitucional {
  id?: string;
  nombreInstitucion: string;
  codigoAmie: string;
  nombreRector: string;
  logo?: string;
  updatedAt?: Timestamp | null;
  updatedBy?: string;
  createdAt?: Timestamp | null;
  createdBy?: string;
}

export default function InstitutionSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasData, setHasData] = useState(false);
  
  const [formData, setFormData] = useState<ConfiguracionInstitucional>({
    nombreInstitucion: '',
    codigoAmie: '',
    nombreRector: '',
    logo: ''
  });

  // ✅ Cargar configuración existente desde Firebase
  const cargarConfiguracion = useCallback(async () => {
    try {
      setLoading(true);
      const configSnap = await getDocs(collection(db, 'configuracionInstitucional'));
      
      if (!configSnap.empty) {
        const docData = configSnap.docs[0].data() as ConfiguracionInstitucional;
        setFormData({
          nombreInstitucion: docData.nombreInstitucion || '',
          codigoAmie: docData.codigoAmie || '',
          nombreRector: docData.nombreRector || '',
          logo: docData.logo || ''
        });
        setHasData(true);
      } else {
        setHasData(false);
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Guardar en Firebase
  const guardarConfiguracion = useCallback(async () => {
    if (!formData.nombreInstitucion || !formData.codigoAmie || !formData.nombreRector) {
      alert('Todos los campos son obligatorios');
      return;
    }

    try {
      setSaving(true);
      
      // Usar ID fijo "principal" para que siempre sea el mismo documento
      const configRef = doc(db, 'configuracionInstitucional', 'principal');
      
      const dataToSave = {
        nombreInstitucion: formData.nombreInstitucion.trim(),
        codigoAmie: formData.codigoAmie.trim(),
        nombreRector: formData.nombreRector.trim(),
        logo: formData.logo || '',
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || ''
      };

      // Si no existe aún, agregar campos de creación
      if (!hasData) {
        await setDoc(configRef, {
          ...dataToSave,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || ''
        });
      } else {
        await setDoc(configRef, dataToSave);
      }

      setHasData(true);
      alert('✅ Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error guardando configuración:', error);
      alert('❌ Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  }, [formData, hasData, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await guardarConfiguracion();
  };

  // ✅ Cargar al montar el componente
  useEffect(() => {
    const loadData = async () => {
      await cargarConfiguracion();
    };
    loadData();
  }, [cargarConfiguracion]);

  if (loading) {
    return (
      <Layout title="Configuración Institucional" subtitle="Datos de la institución" showBack>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto mb-3"></div>
            <p className="text-slate-600 text-sm font-medium">Cargando configuración...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title="Configuración Institucional" 
      subtitle="Datos de la institución para reportes y documentos"
      showBack
    >
      {/* ✅ Mensaje si no hay configuración */}
      {!hasData && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-6 py-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="bg-amber-100 p-2 rounded-full">
              <FaExclamationTriangle className="text-amber-600 text-lg" />
            </div>
            <div className="flex-1">
              <h3 className="text-amber-900 font-bold text-base mb-1">
                Configuración pendiente
              </h3>
              <p className="text-amber-700 text-sm">
                Esta es la primera vez que configuras la institución. Completa los datos a continuación para que aparezcan en todos los reportes del sistema.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Formulario */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-linear-to-r from-blue-600 to-blue-700 px-5 py-3">
          <h3 className="text-white font-semibold text-base flex items-center gap-2">
            <FaBuilding className="text-sm" />
            Datos de la Institución
          </h3>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Sección 1: Datos Generales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Nombre oficial de la institución *
              </label>
              <input
                type="text"
                value={formData.nombreInstitucion}
                onChange={(e) => setFormData({...formData, nombreInstitucion: e.target.value})}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder='Ej: CECIBEB "Leonardo Pérez Muñoz"'
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Código AMIE *
              </label>
              <input
                type="text"
                value={formData.codigoAmie}
                onChange={(e) => setFormData({...formData, codigoAmie: e.target.value})}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Ej: 10B00020"
                required
              />
            </div>
          </div>

          {/* Separador */}
          <div className="border-t border-slate-200 pt-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <FaUserTie className="text-blue-600" />
              Autoridad Máxima
            </h4>
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Nombre completo del Rector/a con título *
              </label>
              <input
                type="text"
                value={formData.nombreRector}
                onChange={(e) => setFormData({...formData, nombreRector: e.target.value})}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Ej: Mgs. Juan Pérez o Lic. María González"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Incluye el título profesional al inicio (Lic., Ing., Dr., Mgs., etc.)
              </p>
            </div>
          </div>

          {/* Separador */}
          <div className="border-t border-slate-200 pt-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <FaImage className="text-blue-600" />
              Logo Institucional
            </h4>
            
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                {formData.logo ? (
                  <img src={formData.logo} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-xs text-slate-400 text-center px-2">Sin logo</span>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  URL del logo o Base64
                </label>
                <input
                  type="text"
                  value={formData.logo}
                  onChange={(e) => setFormData({...formData, logo: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="https://... o data:image/png;base64,..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  Puedes pegar una URL o el código base64 completo del logo
                </p>
              </div>
            </div>
          </div>

          {/* Vista previa */}
          {(formData.nombreInstitucion || formData.codigoAmie || formData.nombreRector) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-blue-800 mb-2">
                <FaCheck className="text-sm" />
                <span className="text-sm font-semibold">Vista previa en reportes:</span>
              </div>
              <div className="text-sm text-blue-900 space-y-1">
                {formData.nombreInstitucion && (
                  <p><strong>Institución:</strong> {formData.nombreInstitucion}</p>
                )}
                {formData.codigoAmie && (
                  <p><strong>Código AMIE:</strong> {formData.codigoAmie}</p>
                )}
                {formData.nombreRector && (
                  <p><strong>Rector/a:</strong> {formData.nombreRector}</p>
                )}
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2 pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaSave className="text-xs" />
              {saving ? 'Guardando...' : (hasData ? 'Actualizar configuración' : 'Guardar configuración')}
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg transition-all text-sm font-medium"
            >
              <FaTimes className="text-xs" />
              Cancelar
            </button>
          </div>
        </div>
      </form>
    </Layout>
  );
}