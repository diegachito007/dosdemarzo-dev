import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { FaTrophy, FaSignOutAlt, FaArrowLeft } from 'react-icons/fa';

interface LayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  action?: ReactNode;
  showFooter?: boolean; // ✅ Nueva prop opcional
}

export default function Layout({ 
  children, 
  title, 
  subtitle,
  showBack = false,
  backTo = '/',
  action,
  showFooter = false // ✅ Por defecto NO muestra footer
}: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header Fijo */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo y Título */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="bg-linear-to-br from-blue-600 to-purple-600 p-2 rounded-lg shadow-md group-hover:scale-105 transition-transform">
                <FaTrophy className="text-white text-xl" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Sistema de Calificaciones
                </h1>
                <p className="text-xs text-slate-500">Gestión educativa integral</p>
              </div>
            </Link>

            {/* Usuario y Logout */}
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
              <div className="text-right hidden md:block">
                <p className="text-sm font-semibold text-slate-800">{user?.displayName}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <img 
                src={user?.photoURL || 'https://via.placeholder.com/150'} 
                alt="avatar" 
                className="w-10 h-10 rounded-full border-2 border-blue-500 shadow-md"
              />
              <button
                onClick={logout}
                className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Cerrar sesión"
              >
                <FaSignOutAlt className="text-lg" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido Principal - flex-grow para ocupar espacio */}
      <main className="grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Barra de navegación */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            {showBack && (
              <button
                onClick={() => navigate(backTo)}
                className="flex items-center gap-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-all"
              >
                <FaArrowLeft />
                <span className="hidden sm:inline">Volver</span>
              </button>
            )}
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
              {subtitle && (
                <p className="text-slate-600 text-sm mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          
          {action && (
            <div className="flex items-center gap-3">
              {action}
            </div>
          )}
        </div>

        {/* Contenido de la página */}
        {children}
      </main>

      {/* ✅ Footer - Solo se muestra si showFooter es true */}
      {showFooter && (
        <footer className="bg-white border-t border-slate-200 mt-auto">
          <div className="max-w-7xl mx-auto px-4 py-4 text-center text-slate-600 text-sm">
            <p>© 2026 Sistema de Calificaciones - Todos los derechos reservados</p>
          </div>
        </footer>
      )}
    </div>
  );
}