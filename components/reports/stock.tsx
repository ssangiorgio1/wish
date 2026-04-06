'use client'

import React, { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Droplets } from 'lucide-react'

export function StockMonitor({ bottles }: { bottles: any[] }) {
  const stats = useMemo(() => {
    // Solo auditamos insumos base (botellas), no recetas de tragos
    const onlyBottles = bottles.filter(b => b.tipo === 'botella');
    
    // 1. PRIORIDAD ABSOLUTA: AGOTADOS
    // Usamos 1.5ml como umbral para capturar ceros técnicos (0.0001ml)
    const outOfStock = onlyBottles.filter(b => Number(b.stockMl || 0) <= 1.5);

    // Creamos un Set de IDs para excluir los agotados de la lista de stock bajo
    const outOfStockIds = new Set(outOfStock.map(b => b.id));

    // 2. BAJO MÍNIMO
    const lowStock = onlyBottles.filter(b => {
        const stock = Number(b.stockMl || 0);
        // Si no tiene mínimo, usamos la capacidad de 1 botella como alerta por defecto
        const min = Number(b.stockMinMl) > 0 ? Number(b.stockMinMl) : Number(b.mlPorUnidad || 750);
        
        return stock <= min && !outOfStockIds.has(b.id);
    });
    
    return { lowStock, outOfStock };
  }, [bottles]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* TARJETAS RESUMEN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-rose-500/10 border-2 border-rose-500/20 p-6 rounded-[2rem] flex items-center gap-4 transition-all hover:bg-rose-500/15">
          <div className="p-4 bg-rose-500 rounded-2xl text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-rose-300 uppercase italic tracking-widest">Crítico</p>
            <h3 className="text-3xl font-black text-white italic tracking-tighter">
              {stats.outOfStock.length} Agotados
            </h3>
          </div>
        </div>

        <div className="bg-amber-500/10 border-2 border-amber-500/20 p-6 rounded-[2rem] flex items-center gap-4 transition-all hover:bg-amber-500/15">
          <div className="p-4 bg-amber-500 rounded-2xl text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-amber-300 uppercase italic tracking-widest">Atención</p>
            <h3 className="text-3xl font-black text-white italic tracking-tighter">
              {stats.lowStock.length} Reponer
            </h3>
          </div>
        </div>
      </div>

      {/* PLANILLA DE REPOSICIÓN */}
      <div className="bg-[#0f172a]/40 border-2 border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-sm">
        <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <h2 className="text-white font-black uppercase italic text-sm tracking-wider flex items-center gap-2">
            Planilla de Reposición Urgente
          </h2>
          <span className="text-[9px] font-bold text-slate-500 uppercase">
            Total a comprar: {stats.outOfStock.length + stats.lowStock.length} SKUs
          </span>
        </div>
        
        <div className="divide-y divide-slate-800">
          {/* RENDERIZADO PRIORITARIO: PRIMERO LOS QUE NO HAY */}
          {stats.outOfStock.map(b => (
            <StockItem key={b.id} bottle={b} status="out" />
          ))}
          
          {/* LUEGO LOS QUE ESTÁN POR TERMINARSE */}
          {stats.lowStock.map(b => (
            <StockItem key={b.id} bottle={b} status="low" />
          ))}

          {stats.outOfStock.length === 0 && stats.lowStock.length === 0 && (
            <div className="p-24 text-center group">
              <CheckCircle2 className="w-16 h-16 text-emerald-500/20 mx-auto mb-4 group-hover:text-emerald-500/40 transition-colors" />
              <p className="text-slate-600 font-black uppercase italic text-xs tracking-[0.4em]">Bodega al día</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StockItem({ bottle, status }: { bottle: any, status: 'out' | 'low' }) {
  // Calculamos unidades reales (botellas) basándonos en los ml
  const units = (Number(bottle.stockMl || 0) / Number(bottle.mlPorUnidad || 750)).toFixed(1);
  
  return (
    <div className="p-6 flex items-center justify-between hover:bg-white/[0.03] transition-all group">
      <div className="flex items-center gap-5">
        {/* Indicador visual con glow */}
        <div className={`w-3 h-3 rounded-full ${
          status === 'out' 
            ? 'bg-rose-500 shadow-[0_0_12px_#ef4444]' 
            : 'bg-amber-500 shadow-[0_0_10px_#f59e0b] animate-pulse'
        }`} />
        
        <div>
          <p className="text-white font-black uppercase italic text-base leading-none tracking-tight group-hover:text-indigo-300 transition-colors">
            {bottle.nombre}
          </p>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1.5 tracking-widest">
            {bottle.marca || 'Genérico'}
          </p>
        </div>
      </div>

      <div className="text-right">
        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${
          status === 'out' 
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' 
            : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
        }`}>
          {status === 'out' ? 'Agotado' : 'Bajo Stock'}
        </span>
        <p className={`text-2xl font-black italic mt-2 tracking-tighter ${
          status === 'out' ? 'text-rose-500' : 'text-slate-200'
        }`}>
          {units} <span className="text-xs text-slate-600 not-italic ml-1">bot.</span>
        </p>
      </div>
    </div>
  )
}