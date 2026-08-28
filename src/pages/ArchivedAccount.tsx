import { useAuth } from '../context/AuthContext';
import { FaArchive, FaEnvelope, FaSignOutAlt, FaInfoCircle } from 'react-icons/fa';

export default function ArchivedAccount() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-slate-600 to-slate-700 px-6 py-8 text-center">
          <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaArchive className="text-white text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Cuenta Archivada</h1>
          <p className="text-white/80 text-sm">
            Tu cuenta ya no está activa en el sistema
          </p>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FaInfoCircle className="text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 text-sm mb-1">
                  ¿Qué significa esto?
                </h3>
                <p className="text-blue-800 text-xs leading-relaxed">
                  Tu cuenta fue archivada por la administración de la institución.
                  Esto suele ocurrir cuando un docente deja de laborar temporal o
                  permanentemente. <strong>Tu historial académico se conserva</strong> para
                  fines de auditoría y trazabilidad.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-semibold text-amber-900 text-sm mb-2 flex items-center gap-2">
              <FaEnvelope className="text-amber-600" />
              ¿Cómo reactivar tu cuenta?
            </h3>
            <p className="text-amber-800 text-xs leading-relaxed mb-3">
              Si has retornado a la institución o necesitas acceso nuevamente,
              contacta al administrador del sistema para solicitar la reactivación.
            </p>
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <p className="text-xs text-slate-600 mb-1">Usuario asociado:</p>
              <p className="font-semibold text-slate-900 text-sm truncate">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
            <strong>Nota:</strong> Una vez reactivado por el administrador,
            podrás volver a ingresar normalmente y se te reasignarán los grados
            correspondientes.
          </div>

          <button
            onClick={async () => await logout()}
            className="w-full inline-flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
          >
            <FaSignOutAlt className="text-sm" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
}