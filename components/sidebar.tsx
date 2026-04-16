'use client'

import { useAuth } from '@/lib/auth-context'
import { 
  Wine, 
  LayoutDashboard, 
  Package, 
  Bell, 
  FileText, 
  LogOut,
  Menu,
  X,
  User,
  Zap,
  Truck,
  ChevronRight
} from 'lucide-react'
import { useState } from 'react'

interface SidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
  alertCount: number
}

// Menú para Propietario: Acceso total
const ownerMenuItems = [
  { id: 'dashboard', label: 'Tablero', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'entrada', label: 'Recepción', icon: Truck }, 
  { id: 'venta', label: 'Ventas', icon: Zap },       
  { id: 'alerts', label: 'Alertas', icon: Bell },
  { id: 'reports', label: 'Reportes', icon: FileText },
]

// Menú para Staff: Enfocado en la operación
const employeeMenuItems = [
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'entrada', label: 'Recepción', icon: Truck },
  { id: 'venta', label: 'Ventas', icon: Zap },
  { id: 'alerts', label: 'Alertas', icon: Bell },
  { id: 'reports', label: 'Reportes', icon: FileText },
]

export function Sidebar({ activeSection, onSectionChange, alertCount }: SidebarProps) {
  const { user, logout } = useAuth()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const menuItems = user?.role === 'owner' ? ownerMenuItems : employeeMenuItems

  const handleSectionChange = (section: string) => {
    onSectionChange(section)
    setIsMobileOpen(false)
  }

  return (
    <>
      {/* --- BOTÓN HAMBURGUESA (Solo Móvil) --- */}
      {!isMobileOpen && (
        <button
          onClick={() => setIsMobileOpen(true)}
          className="lg:hidden fixed top-5 right-5 z-[70] p-3.5 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/40 active:scale-90 transition-all border border-indigo-400/30"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* --- OVERLAY (Fondo oscuro desenfocado) --- */}
      <div 
        className={`
          lg:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[80] transition-opacity duration-300
          ${isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* --- CONTENEDOR SIDEBAR --- */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-[90]
        w-72 bg-[#0a0f1a] lg:bg-slate-900/50 backdrop-blur-2xl border-r border-slate-800/50
        transform transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full p-6 font-rounded">
          
          {/* Header del Sidebar */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center shadow-lg shadow-indigo-600/30 border border-indigo-400/20">
                <Wine className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tighter italic">WISH</h1>
            </div>
            
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-2 text-slate-500 hover:text-white bg-slate-800/50 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tarjeta de Usuario */}
          <div className="mb-8 p-4 bg-slate-800/30 border border-white/5 rounded-[1.5rem] flex items-center gap-3 shadow-inner">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20 shadow-lg">
              <User className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-100 truncate uppercase tracking-tight">{user?.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${user?.role === 'owner' ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                  {user?.role === 'owner' ? 'Owner' : 'Staff'}
                </p>
              </div>
            </div>
          </div>

          {/* Navegación */}
          <nav className="flex-1 space-y-1.5 overflow-y-auto no-scrollbar pr-1">
            <p className="px-4 mb-4 text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] italic">Navegación</p>
            
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              const showBadge = item.id === 'alerts' && alertCount > 0

              return (
                <button
                  key={item.id}
                  onClick={() => handleSectionChange(item.id)}
                  className={`
                    w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left transition-all duration-300 group relative
                    ${isActive 
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 translate-x-1' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 transition-transform group-active:scale-75 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span className={`flex-1 text-[14px] uppercase tracking-tight ${isActive ? 'font-black italic' : 'font-bold'}`}>
                    {item.label}
                  </span>
                  
                  {showBadge ? (
                    <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg animate-bounce shadow-lg shadow-rose-500/40">
                      {alertCount}
                    </span>
                  ) : (
                    isActive && <ChevronRight className="w-4 h-4 opacity-40" />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Footer del Sidebar / Logout */}
          <div className="mt-auto pt-6 border-t border-slate-800/50">
            <button
              onClick={logout}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-all font-black uppercase text-xs tracking-widest group"
            >
              <div className="p-2 rounded-xl bg-slate-800/50 group-hover:bg-rose-500/20 transition-all group-active:scale-90">
                <LogOut className="w-4 h-4" />
              </div>
              <span>Salir</span>
            </button>
          </div>
        </div>
      </aside>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  )
}