'use client'

import React, { useState, useEffect } from 'react'
import { getReportDataCloud, getBottles, getMovements } from '@/lib/store' // ✅ Importamos getMovements
import { useAuth } from '@/lib/auth-context'
import { BarChart3, Calendar, ChevronRight, Loader2 } from 'lucide-react'
import { Botella } from '@/lib/types'

// IMPORTAMOS TUS COMPONENTES
import { Metricas } from './reports/metricas'
import { Auditoria } from './reports/auditoria'
import { Arqueo } from './reports/arqueo'
import { Precios } from './reports/precios' 

const getLocalDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000; 
  const localISOTime = new Date(now.getTime() - offset).toISOString().split('T')[0];
  return localISOTime;
};

export function ReportsView() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'owner'
  
  const [activeTab, setActiveTab] = useState<'metrics' | 'audit' | 'cash' | 'prices'>(isAdmin ? 'metrics' : 'cash')
  const [startDate, setStartDate] = useState(() => getLocalDate())
  const [endDate, setEndDate] = useState(() => getLocalDate())
  
  const [reportData, setReportData] = useState<any>(null)
  const [bottles, setBottles] = useState<Botella[]>([]) 
  const [loading, setLoading] = useState(false)

  const generateReport = async () => {
    setLoading(true)
    try {
      const start = new Date(startDate + 'T00:00:00')
      const end = new Date(endDate + 'T23:59:59')
      
      // 1. Cargamos botellas siempre
      const bottlesData = await getBottles()
      setBottles(bottlesData)

      let data;

      if (activeTab === 'cash') {
        // 🔥 SOLUCIÓN: Si la pestaña es Arqueo, ignoramos las fechas del calendario.
        // Llamamos a getMovements() sin parámetros para que el store use el filtro isClosed == false
        const activeMoves = await getMovements() 
        data = { movements: activeMoves }
      } else {
        // Para Auditoría, Métricas y Precios usamos el rango de fechas
        data = await getReportDataCloud(start, end)
      }
      
      setReportData(data)
    } catch (e) { 
      console.error("Error al sincronizar reportes:", e) 
    } finally { 
      setLoading(false) 
    }
  }

  // ✅ Agregamos activeTab a las dependencias para que refresque al cambiar de pestaña
  useEffect(() => { 
    generateReport() 
  }, [startDate, endDate, activeTab])

  return (
    <div className="space-y-6 lg:space-y-10 animate-in fade-in duration-700 font-rounded pb-24 text-white px-2">
      
      <div className="flex flex-col xl:flex-row justify-between items-center gap-6">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
          <div className="hidden sm:flex w-12 h-12 bg-indigo-600 rounded-2xl items-center justify-center shadow-lg shrink-0">
            <BarChart3 size={24} />
          </div>
          
          <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border-2 border-slate-800 w-full md:w-auto overflow-x-auto no-scrollbar">
            {isAdmin && (
              <button 
                onClick={() => setActiveTab('metrics')} 
                className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'metrics' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
              >
                Métricas
              </button>
            )}
            {isAdmin && (
              <button 
                onClick={() => setActiveTab('prices')} 
                className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'prices' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
              >
                Márgenes
              </button>
            )}
            {isAdmin && (
              <button 
                onClick={() => setActiveTab('audit')} 
                className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
              >
                Auditoría
              </button>
            )}
            <button 
              onClick={() => setActiveTab('cash')} 
              className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'cash' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
            >
              Arqueo
            </button>
          </div>
        </div>

        {/* SELECTOR DE FECHAS - Se deshabilita visualmente si estamos en Arqueo */}
        <div className={`flex items-center justify-center gap-2 bg-slate-900/50 p-2 rounded-[2rem] border-2 border-slate-800 w-full sm:w-auto transition-all ${activeTab === 'cash' ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
          <Calendar className="w-4 h-4 text-indigo-500 ml-1 md:ml-2" />
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
            className="bg-transparent font-black text-[10px] md:text-xs outline-none p-1 w-24 md:w-28 text-white appearance-none" 
          />
          <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-slate-700" />
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
            className="bg-transparent font-black text-[10px] md:text-xs outline-none p-1 w-24 md:w-28 text-white appearance-none" 
          />
        </div>
      </div>

      {loading ? (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sincronizando datos...</p>
        </div>
      ) : (
        <div className="min-h-[60vh] px-1">
          {activeTab === 'metrics' && isAdmin && (
            <Metricas reportData={reportData} />
          )}

          {activeTab === 'prices' && isAdmin && (
            <Precios bottles={bottles} />
          )}

          {activeTab === 'audit' && isAdmin && (
            <Auditoria movements={reportData?.movements || []} />
          )}

          {activeTab === 'cash' && (
            /* 🔥 LE PASAMOS LA FUNCIÓN PARA REFRESCAR DESPUÉS DE CERRAR JORNADA */
            <Arqueo 
              movements={reportData?.movements || []} 
              onAuditSuccess={generateReport} 
            />
          )}
        </div>
      )}

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}