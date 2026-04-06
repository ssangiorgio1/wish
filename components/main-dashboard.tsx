'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './sidebar'
import { DashboardView } from './dashboard-view'
import { InventoryView } from './inventory-view'
import EntranteView from './entrante-view' 
import { VentaView } from './venta-view'
import { AlertsView } from './alerts-view'
import { ReportsView } from './reports-view'
import { getAlerts } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'

export function MainDashboard() {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [alertCount, setAlertCount] = useState(0)
  const { user } = useAuth()

  // REFRESCAR CONTADOR DE ALERTAS
  const refreshAlerts = async () => {
    try {
      const alerts = await getAlerts()
      const unread = alerts.filter((a: any) => a && a.leida === false)
      setAlertCount(unread.length)
    } catch (error) {
      console.error("Error al refrescar alertas:", error)
    }
  }

  useEffect(() => {
    refreshAlerts()
    const interval = setInterval(refreshAlerts, 30000)
    return () => clearInterval(interval)
  }, [])

  // 🔥 FIX DE SCROLL: Resetear al subir arriba cada vez que cambia la sección
  useEffect(() => {
    const mainContent = document.getElementById('main-scroll-container');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeSection]);

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardView onNavigate={setActiveSection} />
      case 'inventory':
        return <InventoryView /> 
      case 'entrada':
        return <EntranteView />
      case 'venta':
        return <VentaView />
      case 'alerts':
        return <AlertsView onRefreshAlerts={refreshAlerts} />
      case 'reports':
        return <ReportsView />
      default:
        return <DashboardView onNavigate={setActiveSection} />
    }
  }

  return (
    // ✅ Corregido: Quitamos el h-full duplicado y dejamos solo 100dvh
    <div className="h-[100dvh] w-full bg-[#0f172a] flex text-slate-200 selection:bg-indigo-500/30 overflow-hidden font-rounded">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        alertCount={alertCount}
      />

      <main className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
        
        {/* ✅ FIX MOBILE: Agregamos touch-pan-y para avisarle al navegador que el scroll vertical es legal */}
        <div 
          id="main-scroll-container"
          className="flex-1 overflow-y-auto custom-scrollbar relative p-0 pt-20 lg:pt-10 lg:p-10 touch-pan-y"
        >
          <div className="w-full max-w-[2600px] mx-auto min-h-full px-2 sm:px-0">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              {renderContent()}
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap');
        
        :root {
          --font-quicksand: 'Quicksand', sans-serif;
        }

        html, body {
          margin: 0;
          padding: 0;
          height: 100dvh;
          width: 100%;
          /* ✅ Importante: quitamos el overflow-hidden de acá para que no bloquee al contenedor hijo */
          background-color: #0f172a;
          font-family: var(--font-quicksand) !important;
          scroll-restoration: manual;
        }

        .font-rounded {
          font-family: var(--font-quicksand) !important;
        }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }

        /* ✅ Liberamos el scroll bloqueado en iOS/Android */
        .custom-scrollbar {
          -webkit-overflow-scrolling: touch;
          /* Quitamos overscroll-behavior-y: none si te sigue fallando */
          overscroll-behavior-y: contain; 
        }
      `}</style>
    </div>
  )
}