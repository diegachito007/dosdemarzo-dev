import { useAuth } from '../context/AuthContext';
import { FcGoogle } from 'react-icons/fc';

export default function Login() {
  const { loginWithGoogle } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-500 to-purple-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Sistema de Calificaciones
          </h1>
          <p className="text-gray-600">Inicia sesión para continuar</p>
        </div>

        <button
          onClick={loginWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 rounded-lg px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all shadow-md"
        >
          <FcGoogle className="text-2xl" />
          Continuar con Google
        </button>

        <p className="text-center text-sm text-gray-500 mt-6">
          Solo cuentas autorizadas pueden acceder
        </p>
      </div>
    </div>
  );
}