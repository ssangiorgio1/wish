'use client'

import React, { useState, useMemo } from 'react'
import { 
  Search, TrendingUp, TrendingDown, Beaker, Box, 
  Filter, AlertTriangle, CheckCircle2, BarChart2, PieChart, 
  ArrowRight, Info, DollarSign, Target
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell
} from 'recharts'
import { Botella } from '@/lib/types'

export function Precios({ bottles }: { bottles: Botella[] }) {
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState<'todos' | 'botella' | 'trago' | 'combo'>('todos')
  const [filterSalud, setFilterSalud] = useState<'todos' | 'alerta' | 'ok'>('todos')

  const fullData = useMemo(() => {
    return bottles.map(item => {
      const isTrago = item.tipo === 'trago' || item.tipo === 'combo';
      const precioVenta = item.precio || 0;
      
      const costoFinal = isTrago ? (item.receta?.reduce((acc, ing) => {
        const insumo = bottles.find(b => b.id === (ing.productId || (ing as any).productID));
        if (!insumo) return acc;

        // 🔥 MEJORA DE LÓGICA: Diferenciar Trago de Combo
        if (item.tipo === 'combo') {
          // Para COMBOS: Multiplicamos el costo unitario por la cantidad de botellas
          return acc + (Number(insumo.precioCosto || 0) * Number(ing.cantidad));
        } else {
          // Para TRAGOS: Cálculo preciso por mililitro
          const costoPorMl = (insumo.precioCosto || 0) / (insumo.mlPorUnidad || 750);
          return acc + (costoPorMl * Number(ing.cantidad));
        }
      }, 0) || 0) : (item.precioCosto || 0);

      const margen = precioVenta - costoFinal;
      const rentabilidad = precioVenta > 0 ? (margen / precioVenta) * 100 : 0;
      const isOnlyInsumo = !isTrago && precioVenta === 0;

      return { ...item, isTrago, costoFinal, margen, rentabilidad, isOnlyInsumo };
    });
  }, [bottles]);

  const filteredData = useMemo(() => {
    return fullData.filter(item => {
      const matchSearch = item.nombre.toLowerCase().includes(search.toLowerCase()) || 
                          item.marca?.toLowerCase().includes(search.toLowerCase());
      const matchTipo = filterTipo === 'todos' || item.tipo === filterTipo;
      const matchSalud = filterSalud === 'todos' || 
                         (filterSalud === 'alerta' ? (item.rentabilidad < 50 && !item.isOnlyInsumo) : (item.rentabilidad >= 50));
      
      return matchSearch && matchTipo && matchSalud;
    }).sort((a, b) => b.rentabilidad - a.rentabilidad);
  }, [fullData, search, filterTipo, filterSalud]);

  const chartData = useMemo(() => {
    return filteredData
      .filter(d => !d.isOnlyInsumo)
      .slice(0, 10) // Mostramos el top 10
      .map(d => ({ name: d.nombre.substring(0, 20), rent: Math.round(d.rentabilidad) }));
  }, [filteredData]);

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 pb-24">
      
      {/* 1. KPIs SUPERIORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-2">
        <KPICard 
          icon={<Target size={20} />} 
          label="Margen Promedio" 
          value={`${(filteredData.filter(d => !d.isOnlyInsumo).reduce((a,b) => a + b.rentabilidad, 0) / (filteredData.filter(d => !d.isOnlyInsumo).length || 1)).toFixed(1)}%`}
          color="indigo"
          sub="Eficiencia de precios"
        />
        <KPICard 
          icon={<AlertTriangle size={20} />} 
          label="Puntos Críticos" 
          value={fullData.filter(d => d.rentabilidad < 45 && !d.isOnlyInsumo).length.toString()}
          color="rose"
          sub="Rentabilidad bajo el 45%"
        />
        <KPICard 
          icon={<TrendingUp size={20} />} 
          label="Top Rentables" 
          value={fullData.filter(d => d.rentabilidad >= 75).length.toString()}
          color="emerald"
          sub="Márgenes superiores al 75%"
        />
      </div>

      {/* 2. ANALÍTICA Y CONTROL */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 px-2">
        {/* FILTROS */}
        <div className="lg:col-span-1 bg-slate-900/60 border border-slate-800 p-6 rounded-[2.5rem] shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Filter size={18} /></div>
            <h4 className="text-white font-black uppercase italic text-sm tracking-tight">Filtros Avanzados</h4>
          </div>
          
          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Clasificación</label>
              <div className="grid grid-cols-2 gap-2">
                {['todos', 'botella', 'trago', 'combo'].map(t => (
                  <button key={t} onClick={() => setFilterTipo(t as any)} className={`py-2.5 rounded-xl text-[9px] font-black uppercase transition-all border ${filterTipo === t ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}>{t}</button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Salud del Margen</label>
              <div className="flex flex-col gap-2">
                <button onClick={() => setFilterSalud('todos')} className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all border ${filterSalud === 'todos' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>Todos los productos</button>
                <button onClick={() => setFilterSalud('alerta')} className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all border ${filterSalud === 'alerta' ? 'bg-rose-600/20 border-rose-500/50 text-rose-400 shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>Revisar Precios (Bajos)</button>
              </div>
            </div>
          </div>
        </div>

        {/* GRÁFICO */}
        <div className="lg:col-span-3 bg-slate-900/40 border border-slate-800 p-6 md:p-10 rounded-[2.5rem] shadow-inner relative overflow-hidden">
           <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
              <BarChart2 size={120} className="text-white" />
           </div>
          <div className="flex justify-between items-start mb-8">
            <div>
              <h4 className="text-white font-black uppercase italic text-lg tracking-tighter">Comparativa de Margen</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 italic">Rentabilidad neta por unidad de salida</p>
            </div>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#b4b4b4" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} interval={0} tick={{fontWeight: 'bold', fill: '#64748b'}} />
                <YAxis stroke="#acacac" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                <Tooltip 
                  cursor={{fill: 'rgba(99,102,241,0.05)'}}
                  contentStyle={{ backgroundColor: '#6b758d', border: '1px solid #1e293b', borderRadius: '16px', fontSize: '11px', fontWeight: 'bold' }} 
                />
                <Bar dataKey="rent" radius={[6, 6, 0, 0]} barSize={32}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.rent > 75 ? '#0cffae' : entry.rent < 45 ? '#f43f5e' : '#6366f1'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. LISTADO MAESTRO */}
      <div className="bg-[#0f172a]/40 border-2 border-slate-800 rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl mx-2">
         <div className="p-6 md:p-10 border-b border-slate-800 bg-slate-900/20 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Explorador de Precios</h2>
              <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{filteredData.length} Items analizados</p>
              </div>
            </div>
            <div className="relative w-full md:w-96">
               <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
               <input 
                  type="text" 
                  placeholder="BUSCAR POR NOMBRE O MARCA..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  className="w-full bg-slate-950 border-2 border-slate-800 text-white py-4 pl-14 pr-6 rounded-[1.5rem] text-xs font-black outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700" 
               />
            </div>
         </div>

         {/* VISTA DESKTOP */}
         <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead className="bg-slate-950/50">
                <tr className="text-slate-500 text-[10px] font-black uppercase border-b border-slate-800">
                  <th className="p-8 text-center">TIPO</th>
                  <th className="p-8">DETALLE DEL PRODUCTO</th>
                  <th className="p-8 text-right">COSTO REAL</th>
                  <th className="p-8 text-right">PVP VENTA</th>
                  <th className="p-8 text-center">GANANCIA UNIT.</th>
                  <th className="p-8 text-center">RENTABILIDAD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.03] transition-all group">
                    <td className="p-8 text-center">
                       <span className={`text-[9px] font-black px-4 py-1.5 rounded-xl uppercase ${row.isTrago ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'} border border-current/10`}>
                          {row.tipo}
                       </span>
                    </td>
                    <td className="p-8">
                      <p className="text-white font-black uppercase italic text-base leading-none group-hover:text-indigo-400 transition-colors">{row.nombre}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-2 tracking-widest">{row.marca || 'Genérico'}</p>
                    </td>
                    <td className="p-8 text-right font-black text-slate-400 text-sm">
                      <span className="text-slate-600 mr-1">$</span>
                      {Math.round(row.costoFinal).toLocaleString()}
                    </td>
                    <td className="p-8 text-right font-black text-emerald-400 text-base">
                      {row.precio > 0 ? `$${row.precio.toLocaleString()}` : '--'}
                    </td>
                    <td className="p-8 text-center">
                      {!row.isOnlyInsumo ? (
                        <div className="inline-flex flex-col items-center">
                           <span className="text-white font-black text-sm">${Math.round(row.margen).toLocaleString()}</span>
                           <span className="text-[8px] text-slate-600 font-black uppercase mt-1">Neto</span>
                        </div>
                      ) : '--'}
                    </td>
                    <td className="p-8">
                       {!row.isOnlyInsumo ? (
                         <div className="flex items-center justify-center gap-5">
                            <div className={`text-sm font-black italic ${row.rentabilidad > 75 ? 'text-emerald-400' : row.rentabilidad < 45 ? 'text-rose-500' : 'text-indigo-400'}`}>
                               {row.rentabilidad.toFixed(0)}%
                            </div>
                            <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                               <div 
                                  className={`h-full transition-all duration-1000 ${row.rentabilidad > 75 ? 'bg-emerald-500' : row.rentabilidad < 45 ? 'bg-rose-500' : 'bg-indigo-500'}`} 
                                  style={{ width: `${Math.min(100, row.rentabilidad)}%` }} 
                                />
                            </div>
                         </div>
                       ) : <span className="text-slate-800 text-center block text-[10px] font-black uppercase tracking-tighter">Uso interno (Insumo)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
         </div>

         {/* VISTA MOBILE */}
         <div className="md:hidden divide-y divide-slate-800/40">
            {filteredData.map((row) => (
              <PriceMobileCard key={row.id} row={row} />
            ))}
         </div>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, color, sub, className = "" }: any) {
  const colors: any = {
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
  };
  return (
    <div className={`bg-slate-900/60 border border-slate-800 p-6 rounded-[2.5rem] flex items-center gap-5 shadow-xl ${className}`}>
      <div className={`p-4 rounded-2xl border ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</p>
        <h3 className="text-2xl font-black text-white italic leading-tight mt-1">{value}</h3>
        <p className="text-[8px] font-bold text-slate-600 uppercase mt-1 italic">{sub}</p>
      </div>
    </div>
  );
}

function PriceMobileCard({ row }: { row: any }) {
  const isAlert = row.rentabilidad < 45 && !row.isOnlyInsumo;

  return (
    <div className={`p-6 space-y-5 transition-all ${isAlert ? 'bg-rose-500/5' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[7px] font-black px-2 py-0.5 rounded-md uppercase border ${row.isTrago ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
              {row.tipo}
            </span>
            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest truncate">{row.marca || 'GENÉRICO'}</span>
          </div>
          <h3 className="text-white font-black uppercase italic text-base truncate leading-none">{row.nombre}</h3>
        </div>
        <div className="text-right shrink-0">
          {!row.isOnlyInsumo ? (
            <div className="flex flex-col items-end">
                <span className={`text-2xl font-black italic leading-none ${row.rentabilidad > 75 ? 'text-emerald-400' : row.rentabilidad < 45 ? 'text-rose-500' : 'text-indigo-400'}`}>
                {row.rentabilidad.toFixed(0)}<span className="text-sm ml-0.5">%</span>
                </span>
                <span className="text-[7px] font-black text-slate-600 uppercase mt-1 tracking-tighter">Rentabilidad</span>
            </div>
          ) : (
            <div className="p-2 bg-slate-800 rounded-lg text-[8px] font-black text-slate-500 uppercase italic border border-slate-700">Insumo</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/50 text-center">
          <p className="text-[7px] font-black text-slate-500 uppercase mb-1">Costo</p>
          <p className="text-[11px] font-bold text-white tracking-tighter">${Math.round(row.costoFinal).toLocaleString()}</p>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/50 text-center">
          <p className="text-[7px] font-black text-slate-500 uppercase mb-1">Venta</p>
          <p className="text-[11px] font-black text-emerald-400 tracking-tighter">${row.precio > 0 ? row.precio.toLocaleString() : '--'}</p>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/50 text-center">
          <p className="text-[7px] font-black text-slate-500 uppercase mb-1">Neto</p>
          <p className="text-[11px] font-black text-indigo-400 tracking-tighter">${!row.isOnlyInsumo ? Math.round(row.margen).toLocaleString() : '--'}</p>
        </div>
      </div>
    </div>
  );
}