'use client'

import React, { useState, useEffect, useRef } from 'react'
import { getBottles, updateBottle, getMovements, finalizarJornadaStock } from '@/lib/store'
import { db } from '@/lib/firebase'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { Botella, MovimientoStock } from '@/lib/types'
import { 
  Loader2, Upload, Search, FileSpreadsheet, CheckCircle2, 
  AlertTriangle, Info, LogOut, CalendarDays, BarChart3, 
  ChevronDown, ChevronUp, History 
} from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// --- COMPONENTE INTERNO DE HISTORIAL ---
function AuditoriaHistoryView() {
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
        toast.error("Error al cargar historial")
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [])

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="animate-spin text-amber-500 w-10 h-10" />
      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Buscando archivos...</p>
    </div>
  )

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {history.map((audit) => (
        <div key={audit.id} className={`bg-slate-900/40 border-2 transition-all rounded-[2.5rem] overflow-hidden ${expandedId === audit.id ? 'border-indigo-500 shadow-xl' : 'border-slate-800'}`}>
          <div onClick={() => setExpandedId(expandedId === audit.id ? null : audit.id)} className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-800/30 transition-colors">
            <div className="flex items-center gap-6">
              <div className="text-left">
                <span className="text-[9px] font-black text-indigo-400 uppercase italic">Jornada Auditada</span>
                <h4 className="text-lg font-black text-white uppercase tracking-tighter leading-none">
                  {format(new Date(audit.fechaCorresponde + "T12:00:00"), "EEEE dd 'de' MMMM", { locale: es })}
                </h4>
              </div>
              <div className="hidden md:block h-8 w-[1px] bg-slate-800" />
              <div className="hidden md:block text-left">
                <span className="text-[9px] font-black text-slate-500 uppercase">Estado General</span>
                <p className={`text-xs font-black uppercase italic ${Math.abs(audit.totalDiferencia) < 1 ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {Math.abs(audit.totalDiferencia) < 1 ? 'Balanceado' : `Desvío: ${audit.totalDiferencia.toFixed(1)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
               <span className="text-[9px] text-slate-600 font-bold uppercase hidden sm:block italic">Cerrado el {format(new Date(audit.fechaCarga), "dd/MM HH:mm")}</span>
               {expandedId === audit.id ? <ChevronUp className="text-indigo-400" /> : <ChevronDown className="text-slate-600" />}
            </div>
          </div>
          {expandedId === audit.id && (
            <div className="px-6 pb-6 animate-in zoom-in-95 duration-200">
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/50">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-500 uppercase border-b border-slate-800">
                      <th className="px-4 py-3">Insumo</th>
                      <th className="px-4 py-3 text-center">Ventas</th>
                      <th className="px-4 py-3 text-center">Físico</th>
                      <th className="px-4 py-3 text-right">Dif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.productos?.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-slate-800/30 last:border-0 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-[11px] font-black text-slate-300 uppercase italic">{p.nombre}</td>
                        <td className="px-4 py-3 text-[11px] text-center font-bold text-rose-500">-{p.vendidos}</td>
                        <td className="px-4 py-3 text-[11px] text-center font-black text-indigo-400">{p.fisico}</td>
                        <td className={`px-4 py-3 text-[11px] text-right font-black ${Math.abs(p.diferencia) > 0.1 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {p.diferencia > 0 ? `+${p.diferencia.toFixed(1)}` : p.diferencia.toFixed(1)}
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

// --- COMPONENTE PRINCIPAL ---
export function AuditoriaView() {
  const [activeTab, setActiveTab] = useState<'auditoria' | 'historial'>('auditoria')
  const [bottles, setBottles] = useState<Botella[]>([])
  const [movements, setMovements] = useState<MovimientoStock[]>([])
  const [loading, setLoading] = useState(true)
  const [isFinishing, setIsFinishing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fechaJornada, setFechaJornada] = useState(() => new Date().toISOString().split('T')[0]);
  const [conteoFisico, setConteoFisico] = useState<Record<string, string>>({})

  const loadData = async () => {
    setLoading(true)
    try {
      const b = await getBottles()
      const m = await getMovements()
      const onlyBottles = b.filter(item => item.tipo === 'botella')
      setBottles(onlyBottles)
      setMovements(m)
      const initialFisico: Record<string, string> = {}
      onlyBottles.forEach(bot => {
        if (bot.conteoFisicoReal) initialFisico[bot.id] = bot.conteoFisicoReal.toString()
      })
      setConteoFisico(initialFisico)
    } catch (error) {
      toast.error("Error al sincronizar con Firebase")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws) as any[]
        let actualizados = 0
        for (const row of data) {
          const nombreExcel = row.Producto || row.nombre || row.Nombre || row["Producto"]
          const stockInicial = parseFloat(row.StockInicial || row.inicial || row["StockInicial"] || 0)
          const bot = bottles.find(b => b.nombre.toLowerCase().trim() === nombreExcel?.toLowerCase().trim())
          if (bot) {
            await updateBottle(bot.id, { stockInicialJornada: stockInicial })
            actualizados++
          }
        }
        toast.success(`Excel procesado: ${actualizados} productos actualizados.`)
        loadData()
      } catch (error) { toast.error("Error al leer el archivo.") }
    }
    reader.readAsBinaryString(file)
  }

  const handleSaveFisico = async (id: string) => {
    const valor = parseFloat(conteoFisico[id]); if (isNaN(valor)) return;
    await updateBottle(id, { conteoFisicoReal: valor });
    toast.success("Conteo guardado", { duration: 800 });
  }

  const handleFinalizar = async () => {
    const confirmacion = confirm(`¿Estás seguro? Se archivará como jornada del día ${fechaJornada}.`);
    if (!confirmacion) return;
    setIsFinishing(true);
    try {
      const detalleParaHistorial = bottles.map(bot => {
        const capacidad = bot.mlPorUnidad || 1
        const vendidos = movements.filter(m => m.botellaId === bot.id && m.tipo === 'venta').reduce((acc, m) => acc + (Number(m.cantidad) || 0), 0)
        const stockApp = (Number(bot.stockMl) || 0) / capacidad
        const fisico = parseFloat(conteoFisico[bot.id]) || 0
        return { nombre: bot.nombre, inicial: bot.stockInicialJornada || 0, vendidos, esperado: stockApp, fisico, diferencia: fisico - stockApp }
      })
      const ok = await finalizarJornadaStock(detalleParaHistorial, fechaJornada)
      if (ok) {
        toast.success("Jornada cerrada y archivada.");
        setConteoFisico({}); loadData();
      } else { toast.error("Error al archivar."); }
    } catch (e) { toast.error("Error crítico."); } finally { setIsFinishing(false); }
  }

  const filteredBottles = bottles.filter(b => b.nombre.toLowerCase().includes(searchTerm.toLowerCase()))

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="animate-spin text-indigo-500 w-10 h-10" />
      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest italic">Sincronizando con Butic Cloud...</p>
    </div>
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* 🔄 SELECTOR DE VISTA (TABS) */}
      <div className="flex justify-center sm:justify-start">
        <div className="flex bg-slate-900/80 p-1.5 rounded-[1.5rem] border-2 border-slate-800 shadow-xl">
          <button 
            onClick={() => setActiveTab('auditoria')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase italic transition-all flex items-center gap-2 ${activeTab === 'auditoria' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <BarChart3 size={14} /> Auditoría Actual
          </button>
          <button 
            onClick={() => setActiveTab('historial')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase italic transition-all flex items-center gap-2 ${activeTab === 'historial' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <History size={14} /> Historial
          </button>
        </div>
      </div>

      {activeTab === 'auditoria' ? (
        <>
          {/* VISTA DE AUDITORÍA (TU CÓDIGO ORIGINAL CON LA FECHA) */}
          <div className="bg-slate-900/80 border-2 border-slate-800 p-6 rounded-[2.5rem] shadow-2xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                        <CalendarDays size={24} />
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-black text-white uppercase italic tracking-tighter leading-none">Fecha de Jornada</h3>
                        <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 italic">¿A qué noche corresponde este control?</p>
                    </div>
                </div>
                <div className="bg-slate-950 p-2 px-4 rounded-2xl border-2 border-slate-800 focus-within:border-indigo-500 transition-all flex items-center gap-3">
                    <input type="date" value={fechaJornada} onChange={(e) => setFechaJornada(e.target.value)} className="bg-transparent text-white font-black text-xs outline-none uppercase" />
                </div>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row justify-between items-center gap-6 bg-slate-900/50 p-8 rounded-[3rem] border-2 border-slate-800 shadow-2xl">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center">
                <FileSpreadsheet size={28} className="text-white" />
              </div>
              <div className="text-left">
                <h2 className="text-2xl font-black uppercase italic leading-none text-white tracking-tighter">Auditoría Física</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-2 flex items-center gap-2 italic"> <Info size={12} /> Carga tu planilla para comparar desvíos </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                <input type="text" placeholder="BUSCAR..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-64 bg-slate-950 border-2 border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-[11px] font-black uppercase outline-none focus:border-indigo-600 text-white" />
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="bg-white text-slate-950 px-6 py-3 rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg">
                <Upload size={16} /> Cargar Stock Inicial
              </button>
              <input type="file" ref={fileInputRef} onChange={handleExcelUpload} accept=".xlsx, .xls" className="hidden" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-[2rem] border-2 border-slate-800 bg-slate-900/20 shadow-xl">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-[10px] text-slate-400 uppercase font-black tracking-widest border-b-2 border-slate-800">
                  <th className="px-8 py-5 text-left">Insumo</th>
                  <th className="px-4 text-center">Inicial</th>
                  <th className="px-4 text-center">Ventas</th>
                  <th className="px-4 text-center">App</th>
                  <th className="px-4 text-center text-indigo-400 italic">Conteo Real</th>
                  <th className="px-8 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-800/50 text-left">
                {filteredBottles.map(bot => {
                  const capacity = bot.mlPorUnidad || 1
                  const vendidos = movements.filter(m => m.botellaId === bot.id && m.tipo === 'venta').reduce((acc, m) => acc + (Number(m.cantidad) || 0), 0)
                  const stockApp = (Number(bot.stockMl) || 0) / capacity
                  const fisico = parseFloat(conteoFisico[bot.id]) || 0
                  const diferencia = fisico - stockApp
                  return (
                    <tr key={bot.id} className="hover:bg-indigo-600/5 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="font-black text-sm uppercase italic text-white group-hover:text-indigo-400">{bot.nombre}</div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase">{bot.marca}</div>
                      </td>
                      <td className="px-4 text-center font-black text-slate-400 italic">{(bot.stockInicialJornada || 0).toFixed(1)}</td>
                      <td className="px-4 text-center text-rose-500 font-black">-{vendidos.toFixed(1)}</td>
                      <td className="px-4 text-center font-black text-slate-200">{stockApp.toFixed(1)}</td>
                      <td className="px-4 text-center">
                        <input type="number" step="0.1" value={conteoFisico[bot.id] || ''} onChange={(e) => setConteoFisico({...conteoFisico, [bot.id]: e.target.value})} onBlur={() => handleSaveFisico(bot.id)} className="bg-slate-950 border-2 border-slate-800 w-24 p-2.5 rounded-xl text-center font-black text-indigo-400 text-xs focus:border-indigo-600 outline-none" />
                      </td>
                      <td className="px-8 text-right font-black">
                        <div className={`flex items-center justify-end gap-2 ${Math.abs(diferencia) < 0.1 ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {diferencia > 0 ? `+${diferencia.toFixed(1)}` : diferencia.toFixed(1)}
                          {Math.abs(diferencia) < 0.1 ? <CheckCircle2 size={16}/> : <AlertTriangle size={16}/>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-6 bg-slate-950/50 p-8 rounded-[2.5rem] border-2 border-slate-800">
            <div className="text-left max-w-md">
                <p className="text-[10px] font-black uppercase text-indigo-400 mb-1 italic">Advertencia de Cierre</p>
                <p className="text-[10px] font-bold uppercase text-slate-500 leading-relaxed"> Al finalizar, los datos se archivarán bajo la fecha <span className="text-white">{fechaJornada}</span>. </p>
            </div>
            <button onClick={handleFinalizar} disabled={isFinishing} className={`bg-rose-600 hover:bg-rose-500 text-white px-10 py-5 rounded-[2rem] font-black uppercase italic transition-all flex items-center gap-3 shadow-xl shadow-rose-600/30 active:scale-95 ${isFinishing ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isFinishing ? <Loader2 className="animate-spin" size={20} /> : <LogOut size={20} />} Finalizar Auditoría
            </button>
          </div>
        </>
      ) : (
        <AuditoriaHistoryView />
      )}
    </div>
  )
}