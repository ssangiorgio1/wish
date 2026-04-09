'use client'

import React, { useState, useMemo } from 'react'
import { 
  Search, Gift, PackagePlus, PackageMinus, Wine, 
  ChevronUp, ChevronDown, Printer, Filter, ShoppingBag, User
} from 'lucide-react'

interface AuditTabProps {
  movements: any[]
}

type FilterType = 'todos' | 'ventas' | 'regalos' | 'entradas';

export function Auditoria({ movements }: AuditTabProps) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<FilterType>('todos')

  // --- LÓGICA DE RE-IMPRESIÓN ---
  const handlePrintAgain = (group: any) => {
    const ticketWindow = window.open('', '_blank');
    if (!ticketWindow) return;
    const isCourtesy = group.isGift;
    const paymentMethod = group.paymentMethod || 'Efectivo';
    const total = group.montoTotal;
    const ticketId = group.id;
    
    // Extraer beneficiario de la nota
    const paraQuien = group.details[0]?.notas?.match(/Para:\s*([^|]+)/i)?.[1]?.trim();

    ticketWindow.document.write(`
      <html>
        <head>
          <style>
            body { font-family: 'Courier New', monospace; width: 80mm; padding: 10px; font-size: 12px; color: #000; }
            .text-center { text-align: center; }
            .header { font-weight: bold; font-size: 16px; margin-bottom: 10px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .total { font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="text-center header">BUTIC</div>
          <div class="text-center">${isCourtesy ? 'INVITACIÓN/REGALO' : 'Comprobante de Venta'}</div>
          <div class="text-center">${new Date(group.createdAt).toLocaleString()}</div>
          <div class="divider"></div>
          ${group.details.map((item: any) => `
            <div class="item">
              <span>${item.cantidad} x ${item.nombreBotella.substring(0, 20)}</span>
              <span>$${Number(item.monto || 0).toLocaleString()}</span>
            </div>
          `).join('')}
          <div class="divider"></div>
          <div class="item">
            <span>MEDIO DE PAGO:</span>
            <span>${isCourtesy ? 'INVITACIÓN/REGALO' : paymentMethod.toUpperCase()}</span>
          </div>
          ${paraQuien ? `<div class="item"><span>PARA:</span><span>${paraQuien.toUpperCase()}</span></div>` : ''}
          <div class="total">
            <span>TOTAL:</span>
            <span>$${total.toLocaleString()}</span>
          </div>
          <div class="divider"></div>
          <div class="text-center" style="font-size: 8px; margin-top: 10px;">Ticket: ${ticketId} (REIMPRESIÓN)</div>
          <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
        </body>
      </html>
    `);
    ticketWindow.document.close();
  };

  // --- LÓGICA DE AGRUPACIÓN (OPTIMIZADA) ---
  const groups = useMemo(() => {
    const res: any[] = [];
    const processedIds = new Set();

    movements.forEach((m: any) => {
      const ticketMatch = m.notas?.match(/TICK-\d+/i);
      const loteMatch = m.batchId || m.notas?.match(/LOTE-\d+/i)?.[0];
      const gId = ticketMatch ? ticketMatch[0] : loteMatch;

      if (gId && !processedIds.has(gId)) {
        const items = movements.filter((item: any) => {
          const itemTicket = item.notas?.match(/TICK-\d+/i);
          const currentItemTicketId = itemTicket ? itemTicket[0] : null;
          return item.batchId === gId || currentItemTicketId === gId;
        });

        const isEntry = m.tipo === 'entrada';
        const latestDate = items.length > 0 
          ? items.reduce((latest, current) => 
              new Date(current.createdAt).getTime() > new Date(latest).getTime() ? current.createdAt : latest, 
              m.createdAt)
          : m.createdAt;

        res.push({
          id: gId,
          isGroup: true,
          tipo: m.tipo,
          createdAt: latestDate,
          nombreUsuario: m.nombreUsuario,
          montoTotal: items.reduce((acc: number, curr: any) => acc + Number(isEntry ? (curr.costo || 0) : (curr.monto || curr.valorCortesia || 0)), 0),
          isGift: !isEntry && (m.notas?.toLowerCase().includes('regalo') || m.notas?.toLowerCase().includes('cortesía')),
          paymentMethod: isEntry ? (m.notas?.split('|')[0] || 'STOCK') : (m.notas?.match(/Pago:\s*([^|]+)/i)?.[1]?.trim() || 'Efectivo'),
          details: items
        });
        
        processedIds.add(gId);
      } else if (!gId) {
        const isEntry = m.tipo === 'entrada';
        res.push({ 
          ...m, 
          id: m.id, 
          isGroup: false, 
          isGift: !isEntry && (m.notas?.toLowerCase().includes('regalo') || m.notas?.toLowerCase().includes('cortesía')), 
          montoTotal: isEntry ? (m.costo || 0) : (m.monto || m.valorCortesia || 0),
          paymentMethod: isEntry ? 'INDIVIDUAL' : 'VENTA INDIV.',
          details: [m]
        });
      }
    });

    return res.filter((g: any) => {
      const s = search.toLowerCase();
      const matchSearch = (g.id || "").toLowerCase().includes(s) || 
                          (g.nombreUsuario || "").toLowerCase().includes(s) ||
                          (g.details.some((d: any) => (d.nombreBotella || "").toLowerCase().includes(s) || (d.notas || "").toLowerCase().includes(s)));
      if (!matchSearch) return false;
      if (filterType === 'ventas') return g.tipo === 'venta' && !g.isGift;
      if (filterType === 'regalos') return g.isGift;
      if (filterType === 'entradas') return g.tipo === 'entrada';
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [movements, search, filterType]);

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-500 pb-20">
      
      <div className="bg-slate-900/50 border border-slate-800 p-3 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] flex flex-col gap-3 shadow-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
          <input 
            type="text" 
            placeholder="Buscar por Ticket, producto o beneficiario..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="w-full bg-slate-950 border border-slate-800 text-white font-bold text-[11px] pl-9 py-3 rounded-xl outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <FilterButton active={filterType === 'todos'} onClick={() => setFilterType('todos')} label="Todos" icon={Filter} color="bg-slate-800" />
          <FilterButton active={filterType === 'ventas'} onClick={() => setFilterType('ventas')} label="Ventas" icon={ShoppingBag} color="bg-indigo-600" />
          <FilterButton active={filterType === 'regalos'} onClick={() => setFilterType('regalos')} label="Regalos" icon={Gift} color="bg-purple-600" />
          <FilterButton active={filterType === 'entradas'} onClick={() => setFilterType('entradas')} label="Stock" icon={PackagePlus} color="bg-orange-600" />
        </div>
      </div>

      {/* VISTA PC */}
      <div className="hidden lg:block bg-[#0f172a]/40 border-2 border-slate-800 rounded-[2.5rem] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-950/50">
              <tr className="text-slate-400 text-[10px] font-black uppercase border-b border-slate-800">
                <th className="p-6">Fecha / Hora</th>
                <th className="p-6">Detalle / ID</th>
                <th className="p-6 text-center">Tipo</th>
                <th className="p-6 text-center">Usuario</th>
                <th className="p-6 text-center">Monto (Valor)</th>
                <th className="p-6 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {groups.map((m: any, i: number) => (
                <AuditRow 
                  key={m.id || i} 
                  m={m} 
                  isExpanded={expanded === m.id} 
                  onToggle={() => setExpanded(expanded === m.id ? null : m.id)} 
                  onPrint={() => handlePrintAgain(m)} 
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* VISTA MOBILE */}
      <div className="lg:hidden flex flex-col gap-2 px-1">
        {groups.map((m: any, i: number) => (
          <AuditMobileCard 
            key={m.id || i} 
            m={m} 
            isExpanded={expanded === m.id} 
            onToggle={() => setExpanded(expanded === m.id ? null : m.id)} 
            onPrint={() => handlePrintAgain(m)}
          />
        ))}
      </div>
    </div>
  )
}

function FilterButton({ active, onClick, label, icon: Icon, color }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all border shrink-0
      ${active ? `${color} border-white/10 text-white shadow-md` : 'bg-slate-900 border-transparent text-slate-500'}`}
    >
      <Icon size={10} />
      {label}
    </button>
  )
}

function AuditMobileCard({ m, isExpanded, onToggle, onPrint }: any) {
  const isEntry = m.tipo === 'entrada';
  const isGift = m.isGift;
  // Extraer el beneficiario de las notas del primer item
  const paraQuien = m.details[0]?.notas?.match(/Para:\s*([^|]+)/i)?.[1]?.trim();

  return (
    <div className={`w-full bg-slate-900/40 border border-slate-800 rounded-[1.2rem] overflow-hidden transition-all ${isExpanded ? 'border-indigo-500/40 bg-slate-900' : ''}`}>
      <div className="p-3.5 flex flex-col gap-2" onClick={onToggle}>
        <div className="flex justify-between items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
               <span className={`text-[6px] font-black px-1.5 py-0.5 rounded uppercase ${isEntry ? 'bg-orange-500' : isGift ? 'bg-purple-600' : 'bg-indigo-600'} text-white`}>
                {isEntry ? 'STOCK' : isGift ? 'GIFT' : 'SALE'}
               </span>
               <span className="text-[8px] font-black text-slate-600 uppercase italic">
                {new Date(m.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
               </span>
            </div>
            <h3 className="text-white font-black text-[11px] uppercase italic truncate tracking-tight">
              {m.id || "SIN ID"}
            </h3>
            {isGift && paraQuien && (
              <div className="flex items-center gap-1 mt-1">
                <User size={8} className="text-purple-400" />
                <span className="text-[8px] font-black text-purple-400 uppercase truncate">Para: {paraQuien}</span>
              </div>
            )}
          </div>
          <div className="text-right ml-2">
            <p className={`text-base font-black italic leading-none ${isEntry ? 'text-orange-400' : (isGift ? 'text-purple-400' : 'text-emerald-400')}`}>
              ${Math.round(m.montoTotal).toLocaleString()}
              {isGift && <span className="block text-[7px] font-black text-purple-500 uppercase tracking-tighter mt-1">Regalo</span>}
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-between border-t border-slate-800/50 pt-2">
          <span className="text-[8px] font-bold text-slate-500 uppercase truncate italic">
            Por: {m.nombreUsuario?.split(' ')[0]}
          </span>
          <span className="text-[8px] font-black text-slate-600 uppercase">
            {m.paymentMethod}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 bg-slate-950/30 border-t border-slate-800">
        <button 
          onClick={(e) => { e.stopPropagation(); m.tipo === 'venta' && onPrint(); }} 
          className={`flex items-center justify-center gap-1.5 py-2 border-r border-slate-800 transition-colors ${m.tipo === 'venta' ? 'text-indigo-400' : 'text-slate-700 opacity-20'}`}
        >
          <Printer size={12} />
          <span className="text-[8px] font-black uppercase">Ticket</span>
        </button>
        <button onClick={onToggle} className={`flex items-center justify-center gap-1.5 py-2 transition-colors ${isExpanded ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          <span className="text-[8px] font-black uppercase">{isExpanded ? 'Ocultar' : 'Ver más'}</span>
        </button>
      </div>

      {isExpanded && (
        <div className="p-2 bg-black/40 space-y-1 animate-in slide-in-from-top-2 duration-300">
          {m.details.map((item: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center bg-slate-900/40 p-2 rounded-lg border border-white/5">
               <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black text-slate-200 uppercase italic truncate">{item.nombreBotella}</p>
                  <p className="text-[7px] text-slate-600 font-bold uppercase mt-0.5">Cant: {item.cantidad}</p>
               </div>
               <p className={`text-[10px] font-black italic shrink-0 ml-2 ${isEntry ? 'text-orange-400' : isGift ? 'text-purple-400' : 'text-emerald-400'}`}>
                 ${Number(isEntry ? (item.costo || 0) : (item.monto || item.valorCortesia || 0)).toLocaleString()}
               </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AuditRow({ m, isExpanded, onToggle, onPrint }: any) {
  const isEntry = m.tipo === 'entrada';
  const isGift = m.isGift;
  // Extraer el beneficiario de las notas del primer item
  const paraQuien = m.details[0]?.notas?.match(/Para:\s*([^|]+)/i)?.[1]?.trim();

  return (
    <>
      <tr className={`hover:bg-white/[0.02] transition-all cursor-pointer ${isGift ? 'bg-purple-500/5' : ''}`} onClick={onToggle}>
        <td className="p-6 text-[10px] font-black text-slate-500 italic">
          {new Date(m.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </td>
        <td className="p-6">
          <div className="flex flex-col">
            <span className="text-white font-black text-sm uppercase italic tracking-tighter">{m.id || "SIN ID"}</span>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold uppercase flex items-center gap-1 ${isGift ? 'text-purple-400' : 'text-indigo-400'} truncate`}>
                {isGift && <Gift size={10} />}
                {m.paymentMethod}
              </span>
              {isGift && paraQuien && (
                <span className="text-[9px] font-black text-white bg-purple-600/40 px-2 py-0.5 rounded italic">
                  PARA: {paraQuien.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="p-6 text-center">
          {isEntry ? <PackagePlus className="w-5 h-5 text-emerald-500 mx-auto" /> : isGift ? <Gift className="w-5 h-5 text-purple-400 mx-auto" /> : <PackageMinus className="w-5 h-5 text-rose-500 mx-auto" />}
        </td>
        <td className="p-6 text-center text-xs font-black text-slate-400 uppercase italic">{m.nombreUsuario}</td>
        <td className={`p-6 text-center font-black text-lg italic ${isEntry ? 'text-orange-400' : (isGift ? 'text-purple-400' : 'text-emerald-400')}`}>
          ${Number(m.montoTotal || 0).toLocaleString()}
          {isGift && <span className="block text-[8px] font-black text-purple-500 uppercase tracking-[0.2em] mt-1">Cortesía</span>}
        </td>
        <td className="p-6 text-center">
          <div className="flex items-center justify-center gap-2">
            {m.tipo === 'venta' && (
              <button onClick={(e) => { e.stopPropagation(); onPrint(); }} className="p-3 bg-slate-800 hover:bg-white hover:text-slate-900 rounded-xl transition-all">
                <Printer size={16} />
              </button>
            )}
            <button className={`p-3 rounded-xl transition-all ${isExpanded ? 'bg-indigo-600' : 'bg-slate-800'}`}>
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-slate-950/60">
          <td colSpan={6} className="p-8 border-y border-slate-800">
            <div className="space-y-3 max-w-2xl mx-auto">
              {m.details.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center bg-slate-900/60 p-4 rounded-2xl border border-slate-800/50">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-4">
                      <Wine className={`w-4 h-4 ${isEntry ? 'text-emerald-500' : 'text-slate-500'}`} />
                      <span className="text-sm font-black text-white uppercase italic">{item.nombreBotella}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-10">
                    <span className="text-xs font-bold text-slate-500 uppercase">x{item.cantidad}</span>
                    <span className={`text-md font-black italic ${isEntry ? 'text-orange-400' : isGift ? 'text-purple-400' : 'text-emerald-400'}`}>
                      ${Number(isEntry ? (item.costo || 0) : (item.monto || item.valorCortesia || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}