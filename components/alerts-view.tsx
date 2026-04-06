'use client'

import { useState, useEffect } from 'react'
import { getAlerts, markAlertAsRead, getBottles } from '@/lib/store'
import { Botella, Alerta } from '@/lib/types'
import { 
  Bell, AlertTriangle, XCircle, CheckCheck, 
  Loader2, Clock, Droplets, RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'

export function AlertsView({ onRefreshAlerts }: { onRefreshAlerts?: () => void }) {
  const [alerts, setAlerts] = useState<Alerta[]>([])
  const [bottles, setBottles] = useState<Botella[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('unread')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [alertsData, bottlesData] = await Promise.all([
        getAlerts(),
        getBottles()
      ])
      
      const sortedAlerts = (alertsData as Alerta[]).sort((a, b) => {
        if (a.leida !== b.leida) return a.leida ? 1 : -1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

      setAlerts(sortedAlerts)
      setBottles(bottlesData as Botella[])
      if (onRefreshAlerts) onRefreshAlerts()
    } catch (error) {
      console.error("Error cargando alertas:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (alertId: string) => {
    setActionLoading(alertId)
    try {
      const success = await markAlertAsRead(alertId)
      if (success) {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, leida: true } : a))
        if (onRefreshAlerts) onRefreshAlerts()
        toast.success("Alerta archivada")
        await loadData(true)
      }
    } catch (e) {
      toast.error("Error al procesar")
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(() => loadData(true), 30000)
    return () => clearInterval(interval)
  }, [])

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'unread') return !alert.leida
    if (filter === 'read') return alert.leida
    return true
  })

  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-rose-500 opacity-20" />
      <p className="text-slate-500 font-black text-[9px] uppercase tracking-[0.3em] animate-pulse">Sincronizando...</p>
    </div>
  )

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32 font-rounded max-w-5xl mx-auto px-2 sm:px-6">
      {/* HEADER RESPONSIVE */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-900/40 p-5 sm:p-8 rounded-[2.5rem] border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-500/20 shrink-0">
            <Bell className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h2 className="text-xl sm:text-3xl font-black text-white uppercase italic tracking-tighter leading-none">Alertas</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Gestión de Faltantes</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex bg-slate-950/50 p-1.5 rounded-2xl border border-slate-800 w-full sm:w-auto overflow-x-auto no-scrollbar">
            {(['unread', 'read', 'all'] as const).map((t) => (
              <button 
                key={t} 
                onClick={() => setFilter(t)} 
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${filter === t ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {t === 'unread' ? `Pendientes (${alerts.filter(a => !a.leida).length})` : t === 'read' ? 'Historial' : 'Todas'}
              </button>
            ))}
          </div>
          <button onClick={() => loadData()} className="w-full sm:w-auto p-4 bg-slate-800 hover:bg-white hover:text-slate-950 rounded-2xl text-slate-300 transition-all shadow-inner active:scale-90">
            <RefreshCw size={20} className="mx-auto" />
          </button>
        </div>
      </div>

      {/* LISTA DE ALERTAS */}
      <div className="grid gap-4">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-900/10 rounded-[3rem] border-2 border-dashed border-slate-800/30">
            <div className="w-20 h-20 bg-slate-800/20 rounded-full flex items-center justify-center mb-6">
              <CheckCheck className="w-10 h-10 text-emerald-500/30" />
            </div>
            <p className="text-slate-600 text-[11px] font-black uppercase italic tracking-[0.2em]">Todo bajo control por acá.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const bottle = bottles.find(b => b.id === alert.botellaId);
            const currentStockMl = Number(bottle?.stockMl || 0);
            const isActualOut = currentStockMl <= 1.5; 
            
            const stockActualBot = (bottle && bottle.mlPorUnidad > 0) 
              ? (currentStockMl / Number(bottle.mlPorUnidad)).toFixed(1) 
              : '0.0';

            return (
              <div 
                key={alert.id} 
                className={`group p-5 sm:p-6 rounded-[2.2rem] border-2 transition-all duration-500 flex flex-col sm:flex-row items-center gap-5 sm:gap-6 ${
                  alert.leida 
                  ? 'border-slate-800/40 bg-transparent opacity-40 grayscale' 
                  : isActualOut 
                    ? 'border-rose-500/40 bg-rose-500/[0.03] shadow-[0_10px_30px_rgba(244,63,94,0.05)]' 
                    : 'border-orange-500/40 bg-orange-500/[0.03]'
                }`}
              >
                {/* ICONO */}
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[1.8rem] shrink-0 flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110 duration-500 ${
                  alert.leida 
                    ? 'bg-slate-800 text-slate-600' 
                    : isActualOut 
                      ? 'bg-rose-600 text-white shadow-rose-900/40' 
                      : 'bg-orange-500 text-white shadow-orange-900/40'
                }`}>
                  {isActualOut ? <XCircle size={32} /> : <AlertTriangle size={32} />}
                </div>
                
                {/* CONTENIDO TEXTO */}
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <h4 className={`text-2xl sm:text-3xl font-black uppercase italic leading-none tracking-tighter truncate ${alert.leida ? 'text-slate-500' : 'text-white'}`}>
                      {alert.nombreBotella}
                    </h4>
                    {!alert.leida && (
                      <div className={`w-fit mx-auto sm:mx-0 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest ${isActualOut ? 'bg-rose-600 animate-pulse' : 'bg-orange-600'} text-white`}>
                        {isActualOut ? 'Sin Stock' : 'Casi vacío'}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-6 gap-y-2 mt-4 sm:mt-3">
                    <div className={`flex items-center gap-2 font-black italic text-base ${alert.leida ? 'text-slate-600' : isActualOut ? 'text-rose-500' : 'text-orange-400'}`}>
                      <Droplets size={16} />
                      {stockActualBot} <span className="text-[10px] not-italic opacity-40 uppercase tracking-tighter">Unidades</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                      <Clock size={14} className="opacity-50" />
                      {new Date(alert.createdAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                </div>

                {/* BOTÓN ARCHIVAR */}
                {!alert.leida && (
                  <button
                    onClick={() => handleMarkAsRead(alert.id!)}
                    disabled={actionLoading === alert.id}
                    className="w-full sm:w-auto flex items-center justify-center gap-3 bg-white text-slate-950 hover:bg-emerald-500 hover:text-white px-10 py-5 sm:py-6 rounded-[1.5rem] font-black uppercase italic text-xs transition-all active:scale-90 disabled:opacity-50 shadow-2xl"
                  >
                    {actionLoading === alert.id ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <>Listo <CheckCheck size={20} /></>
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
      
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}