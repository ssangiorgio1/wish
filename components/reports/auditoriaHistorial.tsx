'use client'

import React, { useState, useEffect } from 'react'
import { db } from '@/lib/firebase' // Ajustá la ruta según tu proyecto
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { Loader2, Calendar, ChevronDown, ChevronUp, FileText, BarChart3, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function AuditoriaHistory() {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const q = query(collection(db, 'history_audits'), orderBy('fechaCorresponde', 'desc'))
        const querySnapshot = await getDocs(q)
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setHistory(docs)
      } catch (error) {
        console.error("Error al cargar historial:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [])

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="animate-spin text-indigo-500 w-10 h-10" />
      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Cargando registros pasados...</p>
    </div>
  )

  if (history.length === 0) return (
    <div className="text-center p-20 bg-slate-900/20 rounded-[3rem] border-2 border-dashed border-slate-800">
      <AlertCircle className="mx-auto text-slate-600 mb-4" size={40} />
      <p className="text-sm font-black uppercase text-slate-500 italic">No hay cierres archivados todavía</p>
    </div>
  )

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4 mb-8">
         <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-500/30">
            <BarChart3 size={24} />
         </div>
         <div>
            <h2 className="text-xl font-black uppercase italic text-white leading-none">Registros Históricos</h2>
            <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Consulta los desvíos de noches anteriores</p>
         </div>
      </div>

      {history.map((audit) => (
        <div 
          key={audit.id} 
          className={`bg-slate-900/40 border-2 transition-all duration-300 rounded-[2rem] overflow-hidden ${expandedId === audit.id ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : 'border-slate-800'}`}
        >
          {/* HEADER DEL CARD */}
          <div 
            onClick={() => setExpandedId(expandedId === audit.id ? null : audit.id)}
            className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-indigo-400 uppercase italic">Jornada del</span>
                <span className="text-lg font-black text-white uppercase tracking-tighter">
                   {format(new Date(audit.fechaCorresponde + "T12:00:00"), "EEEE dd 'de' MMMM", { locale: es })}
                </span>
              </div>
              
              <div className="h-10 w-[2px] bg-slate-800 hidden sm:block"></div>

              <div className="hidden md:flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase">Diferencia Total</span>
                <span className={`text-sm font-black ${audit.totalDiferencia < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {audit.totalDiferencia > 0 ? `+${audit.totalDiferencia.toFixed(1)}` : audit.totalDiferencia.toFixed(1)} Unid.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] text-slate-600 font-bold uppercase">Cargado el {format(new Date(audit.fechaCarga), "dd/MM HH:mm")}</p>
              </div>
              {expandedId === audit.id ? <ChevronUp className="text-indigo-400" /> : <ChevronDown className="text-slate-600" />}
            </div>
          </div>

          {/* DETALLE EXPANDIBLE */}
          {expandedId === audit.id && (
            <div className="px-6 pb-6 pt-2 animate-in slide-in-from-top-2 duration-300">
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/50">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3 text-center">Inicial</th>
                      <th className="px-4 py-3 text-center">Ventas</th>
                      <th className="px-4 py-3 text-center">Esperado</th>
                      <th className="px-4 py-3 text-center">Físico</th>
                      <th className="px-4 py-3 text-right">Dif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.productos.map((prod: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-800/30 last:border-0 hover:bg-white/5">
                        <td className="px-4 py-3 text-xs font-black text-slate-300 uppercase italic">{prod.nombre}</td>
                        <td className="px-4 py-3 text-xs text-center font-bold text-slate-500">{prod.inicial}</td>
                        <td className="px-4 py-3 text-xs text-center font-bold text-rose-500">-{prod.vendidos}</td>
                        <td className="px-4 py-3 text-xs text-center font-bold text-slate-400">{prod.esperado?.toFixed(1)}</td>
                        <td className="px-4 py-3 text-xs text-center font-black text-indigo-400">{prod.fisico}</td>
                        <td className={`px-4 py-3 text-xs text-right font-black ${Math.abs(prod.diferencia) > 0.1 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {prod.diferencia > 0 ? `+${prod.diferencia.toFixed(1)}` : prod.diferencia.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}