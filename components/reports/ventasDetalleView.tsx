'use client'

import React, { useState, useMemo } from 'react'
import { Search, Clock, ShoppingBag, Tag, CalendarDays, ArrowRight, Download } from 'lucide-react'

interface Props {
  startDate: string; // Formato "YYYY-MM-DD"
  endDate: string;
  reportData: any;
}

export function VentasDetalleView({ startDate, endDate, reportData }: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS')
  
  // 🔥 Nuevo: Fecha a la que corresponde la auditoría (por si carga atrasado)
  const [fechaCorresponde, setFechaCorresponde] = useState(startDate)

  // Horas de corte (Por defecto cubrimos la franja nocturna clásica)
  const [horaInicio, setHoraInicio] = useState(21) 
  const [horaFin, setHoraFin] = useState(7)    

  const movements = reportData?.movements || []

  const categorias = useMemo<string[]>(() => {
    const cats = movements.map((m: any) => (m.categoria?.toUpperCase() || 'OTROS') as string);
    const setSinDuplicados = Array.from(new Set<string>(cats));
    return ['TODAS', ...setSinDuplicados];
  }, [movements]);

  const groupedSales = useMemo(() => {
    // 1. Construimos los puntos exactos de tiempo combinando Fecha + Hora
    const startFull = new Date(`${startDate}T${horaInicio.toString().padStart(2, '0')}:00:00`);
    const endFull = new Date(`${endDate}T${horaFin.toString().padStart(2, '0')}:59:59`);

    const agrupados: Record<string, any> = {};

    movements.forEach((m: any) => {
      if (m.tipo !== 'venta') return;

      const fechaTicket = new Date(m.createdAt);
      
      const pasaTiempo = fechaTicket >= startFull && fechaTicket <= endFull;
      const pasaCategoria = selectedCategory === 'TODAS' || m.categoria?.toUpperCase() === selectedCategory;
      const pasaBusqueda = m.nombreBotella.toLowerCase().includes(searchTerm.toLowerCase());

      if (pasaTiempo && pasaCategoria && pasaBusqueda) {
        const id = m.botellaId;
        if (!agrupados[id]) {
          agrupados[id] = { 
            name: m.nombreBotella, 
            count: 0, 
            total: 0, 
            cat: m.categoria || 'OTROS' 
          };
        }
        agrupados[id].count += Number(m.cantidad || 0);
        agrupados[id].total += Number(m.monto || 0);
      }
    });

    return Object.values(agrupados).sort((a: any, b: any) => b.count - a.count);
  }, [movements, startDate, endDate, horaInicio, horaFin, selectedCategory, searchTerm]);

  // 🔥 Función para exportar lo filtrado a un formato legible
  const handleExportResumen = () => {
    let csvContent = "Producto;Categoria;Unidades;Subtotal\n";
    groupedSales.forEach((item: any) => {
      csvContent += `${item.name};${item.cat};${item.count.toFixed(2)};${item.total}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Resumen_Ventas_${fechaCorresponde}.csv`);
    link.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* PANEL DE CONTROL DINÁMICO */}
      <div className="bg-slate-900/50 p-8 rounded-[3rem] border-2 border-slate-800 shadow-2xl">
        <div className="flex flex-col xl:flex-row justify-between items-center gap-8">
          
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Clock size={28} className="text-white" />
            </div>
            <div className="text-left">
              <h2 className="text-2xl font-black uppercase italic leading-none text-white tracking-tighter">Análisis de Jornada</h2>
              {/* 🔥 Nuevo: Selector de fecha de jornada */}
              <div className="flex items-center gap-2 mt-3 bg-slate-950 p-1 px-3 rounded-xl border border-slate-800">
                <p className="text-[9px] font-black text-slate-500 uppercase italic">Corresponde al:</p>
                <input 
                    type="date" 
                    value={fechaCorresponde} 
                    onChange={(e) => setFechaCorresponde(e.target.value)}
                    className="bg-transparent text-[10px] font-black text-indigo-400 outline-none uppercase"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 justify-center">
            {/* SELECTOR HORA INICIO */}
            <div className="flex flex-col gap-1.5 items-start">
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 italic">Desde las:</label>
              <div className="bg-slate-950 px-4 py-3 rounded-2xl border-2 border-slate-800 focus-within:border-indigo-500 transition-all">
                <select value={horaInicio} onChange={(e) => setHoraInicio(Number(e.target.value))} className="bg-transparent text-white text-xs font-black outline-none cursor-pointer">
                  {Array.from({length: 24}).map((_, i) => <option key={i} value={i} className="bg-slate-900">{i.toString().padStart(2, '0')}:00 hs</option>)}
                </select>
              </div>
            </div>

            {/* SELECTOR HORA FIN */}
            <div className="flex flex-col gap-1.5 items-start">
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 italic">Hasta las:</label>
              <div className="bg-slate-950 px-4 py-3 rounded-2xl border-2 border-slate-800 focus-within:border-emerald-500 transition-all">
                <select value={horaFin} onChange={(e) => setHoraFin(Number(e.target.value))} className="bg-transparent text-white text-xs font-black outline-none cursor-pointer">
                  {Array.from({length: 24}).map((_, i) => <option key={i} value={i} className="bg-slate-900">{i.toString().padStart(2, '0')}:00 hs</option>)}
                </select>
              </div>
            </div>

            {/* CATEGORÍA */}
            <div className="flex flex-col gap-1.5 items-start">
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 italic">Categoría</label>
              <div className="bg-slate-950 px-4 py-3 rounded-2xl border-2 border-slate-800">
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-transparent text-white text-xs font-black outline-none cursor-pointer uppercase">
                  {categorias.map((c: string) => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                </select>
              </div>
            </div>

            {/* BUSCADOR */}
            <div className="flex flex-col gap-1.5 items-start">
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 italic">Filtro Rápido</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                <input 
                  type="text"
                  placeholder="BUSCAR..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-950 border-2 border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-xs font-black uppercase outline-none focus:border-indigo-600 text-white w-32 transition-all"
                />
              </div>
            </div>

            {/* 🔥 Botón Exportar */}
            <button 
                onClick={handleExportResumen}
                className="mt-4 xl:mt-0 p-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-lg transition-all active:scale-95"
                title="Exportar este resumen"
            >
                <Download size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* GRILLA DE RESULTADOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {groupedSales.length > 0 ? (
          groupedSales.map((item: any, i: number) => (
            <div key={i} className="bg-[#0f172a]/40 border-2 border-slate-800 p-6 rounded-[2.5rem] relative overflow-hidden group hover:border-indigo-500 transition-all shadow-xl text-left">
               <div className="flex justify-between items-start mb-4">
                 <div className="text-left">
                   <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{item.cat}</p>
                   <h4 className="font-black text-sm uppercase italic text-white leading-tight mt-1 max-w-[130px]">{item.name}</h4>
                 </div>
                 <span className="text-[10px] font-black text-slate-700">#{i+1}</span>
              </div>
              <div className="flex items-end justify-between mt-6">
                 <div className="text-left">
                    <p className="text-[11px] font-black text-slate-400 uppercase mb-1">Unidades</p>
                    <p className="text-2xl font-black text-white italic leading-none">{item.count.toFixed(1)}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[11px] font-black text-slate-400 uppercase mb-1">Subtotal</p>
                    <p className="text-lg font-black text-emerald-500">${item.total.toLocaleString()}</p>
                 </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-[3rem] text-center">
            <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest italic">Sin ventas registradas en este horario</p>
          </div>
        )}
      </div>
    </div>
  )
}