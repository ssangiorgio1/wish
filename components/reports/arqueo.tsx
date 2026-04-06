'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { saveCashAudit, db } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { 
  Monitor, Calculator, Banknote, Landmark, 
  CreditCard, ArrowDownCircle, Loader2, History,
  ChevronUp, ChevronDown, CheckCircle2, AlertCircle, Printer
} from 'lucide-react'
import { 
  collection, query, orderBy, limit, getDocs 
} from "firebase/firestore"
import { toast } from 'sonner'

interface ArqueoProps {
  movements: any[];
  onAuditSuccess?: () => Promise<void>;
}

export function Arqueo({ movements, onAuditSuccess }: ArqueoProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'owner'
  
  const [cashUserFilter, setCashUserFilter] = useState<string>(isAdmin ? 'todos' : user?.name || '')
  const [manualCash, setManualCash] = useState({ efectivo: '', transferencia: '', tarjeta: '' })
  const [savingAudit, setSavingAudit] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const activeMovements = useMemo(() => {
    return movements.filter(m => !m.isClosed);
  }, [movements]);

  const loadHistory = async () => {
    try {
      const q = query(collection(db, 'cash_audits'), orderBy('createdAt', 'desc'), limit(15));
      const snap = await getDocs(q);
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error al cargar historial:", e);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [])

  const cashFlow = useMemo(() => {
    const filtered = activeMovements.filter((m: any) => 
      m.tipo === 'venta' && (cashUserFilter === 'todos' ? true : m.nombreUsuario === cashUserFilter)
    );

    const getMontoPorMetodo = (metodo: string) => {
      return filtered
        .filter((m: any) => (m.notas || "").toLowerCase().includes(`pago: ${metodo.toLowerCase()}`))
        .reduce((a: number, c: any) => a + Number(c.monto || 0), 0);
    };

    const efectivo = getMontoPorMetodo('Efectivo');
    const transferencia = getMontoPorMetodo('Transferencia');
    const tarjeta = getMontoPorMetodo('Tarjeta');

    return {
      Efectivo: efectivo,
      Transferencia: transferencia,
      Tarjeta: tarjeta,
      total: efectivo + transferencia + tarjeta
    };
  }, [activeMovements, cashUserFilter]);

  const usersList = useMemo(() => {
    return Array.from(new Set(movements.map((m: any) => m.nombreUsuario).filter(Boolean))) as string[];
  }, [movements]);

  const printAuditTicket = (data: any) => {
    const ticketWindow = window.open('', '_blank', 'width=300,height=600');
    if (!ticketWindow) return;

    ticketWindow.document.write(`
      <html>
        <head>
          <style>
            body { font-family: 'Courier New', monospace; width: 80mm; padding: 10px; font-size: 12px; }
            .text-center { text-align: center; }
            .header { font-weight: bold; font-size: 16px; margin-bottom: 5px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .bold { font-weight: bold; }
            .footer { font-size: 8px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="text-center header">BUTIC</div>
          <div class="text-center">CIERRE DE CAJA</div>
          <div class="text-center">${new Date(data.createdAt).toLocaleString()}</div>
          <div class="divider"></div>
          <div class="row"><span class="bold">TERMINAL:</span> <span>${data.terminal.toUpperCase()}</span></div>
          <div class="row"><span class="bold">RESPONSABLE:</span> <span>${data.usuarioReporta}</span></div>
          <div class="divider"></div>
          <div class="text-center bold">DESGLOSE DE VALORES</div>
          <div class="row"><span>Efectivo (Sist):</span> <span>$${data.esperado.Efectivo.toLocaleString()}</span></div>
          <div class="row"><span>Efectivo (Real):</span> <span>$${data.real.Efectivo.toLocaleString()}</span></div>
          <div class="divider"></div>
          <div class="row"><span>Transf. (Sist):</span> <span>$${data.esperado.Transferencia.toLocaleString()}</span></div>
          <div class="row"><span>Transf. (Real):</span> <span>$${data.real.Transferencia.toLocaleString()}</span></div>
          <div class="divider"></div>
          <div class="row"><span>Tarjeta (Sist):</span> <span>$${data.esperado.Tarjeta.toLocaleString()}</span></div>
          <div class="row"><span>Tarjeta (Real):</span> <span>$${data.real.Tarjeta.toLocaleString()}</span></div>
          <div class="divider"></div>
          <div class="row bold"><span>TOTAL ESPERADO:</span> <span>$${data.esperado.total.toLocaleString()}</span></div>
          <div class="row bold"><span>TOTAL CONTADO:</span> <span>$${data.totalFisico.toLocaleString()}</span></div>
          <div class="divider"></div>
          <div class="row bold" style="font-size: 15px;">
            <span>DIFERENCIA:</span> 
            <span>${data.diferencia >= 0 ? '+' : ''}$${data.diferencia.toLocaleString()}</span>
          </div>
          <div class="divider"></div>
          <div class="text-center" style="margin-top: 30px;">_______________________</div>
          <div class="text-center">Firma del Cajero</div>
          <div class="footer text-center">ID: ${data.id}</div>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    ticketWindow.document.close();
  };

  const handleSaveAudit = async () => {
    if (!manualCash.efectivo && !manualCash.transferencia && !manualCash.tarjeta) {
        return toast.error("Ingresá los valores contados en caja");
    }
    
    setSavingAudit(true);
    try {
        const totalReal = Number(manualCash.efectivo || 0) + Number(manualCash.transferencia || 0) + Number(manualCash.tarjeta || 0);
        const auditData = {
            terminal: cashUserFilter,
            esperado: {
              Efectivo: cashFlow.Efectivo,
              Transferencia: cashFlow.Transferencia,
              Tarjeta: cashFlow.Tarjeta,
              total: cashFlow.total
            },
            real: { 
                Efectivo: Number(manualCash.efectivo || 0), 
                Transferencia: Number(manualCash.transferencia || 0), 
                Tarjeta: Number(manualCash.tarjeta || 0) 
            },
            totalFisico: totalReal,
            diferencia: totalReal - cashFlow.total,
            usuarioReporta: user?.name || 'Sistema',
            createdAt: new Date().toISOString()
        };

        const res = await saveCashAudit(auditData);
        
        if (res) {
          toast.success("Jornada cerrada y ticket generado");
          printAuditTicket(auditData); 
          setManualCash({ efectivo: '', transferencia: '', tarjeta: '' });
          if (onAuditSuccess) await onAuditSuccess();
          loadHistory(); 
        }
    } catch (e) {
        toast.error("Error al procesar el cierre");
    } finally {
        setSavingAudit(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-700 space-y-8 pb-24 px-1 md:px-2 overflow-x-hidden">
      
      <div className="bg-slate-900/80 border-2 border-indigo-500/30 p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl w-full">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 shrink-0"><Monitor size={28} /></div>
            <div className="min-w-0">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Arqueo Jornada Activa</p>
                <h3 className="text-white font-black uppercase italic text-lg md:text-xl truncate">
                    {cashUserFilter === 'todos' ? 'CIERRE GLOBAL' : `CAJA: ${cashUserFilter}`}
                </h3>
            </div>
          </div>
          {isAdmin && (
            <select 
                value={cashUserFilter} 
                onChange={(e) => setCashUserFilter(e.target.value)} 
                className="w-full md:w-auto bg-slate-950 border-2 border-slate-800 text-white font-black p-3 md:p-4 rounded-2xl outline-none shadow-lg focus:border-indigo-500 transition-all"
            >
              <option value="todos">CIERRE GLOBAL (ADMIN)</option>
              {usersList.map((u: string) => <option key={u} value={u}>{u.toUpperCase()}</option>)}
            </select>
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/40 border-2 border-slate-800 p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] backdrop-blur-md">
                <div className="flex items-center gap-3 mb-8">
                    <Calculator className="text-indigo-500 w-5 h-5" />
                    <h3 className="text-white font-black uppercase italic text-lg tracking-tighter">Declaración de Valores</h3>
                </div>
                
                <div className="space-y-4">
                    <ManualInput label="Efectivo" icon={Banknote} value={manualCash.efectivo} onChange={(v: string) => setManualCash({...manualCash, efectivo: v})} expected={cashFlow.Efectivo} />
                    <ManualInput label="Transferencia" icon={Landmark} value={manualCash.transferencia} onChange={(v: string) => setManualCash({...manualCash, transferencia: v})} expected={cashFlow.Transferencia} />
                    <ManualInput label="Tarjeta / POS" icon={CreditCard} value={manualCash.tarjeta} onChange={(v: string) => setManualCash({...manualCash, tarjeta: v})} expected={cashFlow.Tarjeta} />
                </div>

                <button 
                    onClick={handleSaveAudit} 
                    disabled={savingAudit || cashFlow.total === 0} 
                    className="w-full mt-8 py-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl rounded-3xl shadow-2xl uppercase italic flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-20"
                >
                    {savingAudit ? <Loader2 className="animate-spin" /> : <ArrowDownCircle size={24} />} 
                    Finalizar Jornada e Imprimir Ticket
                </button>
            </div>
        </div>

        <div className="space-y-6">
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <Banknote className="absolute -right-4 -bottom-4 w-32 h-32 text-white opacity-10" />
                <p className="text-indigo-200 font-black uppercase text-[10px] mb-2 tracking-widest italic">Total en Sistema</p>
                <h2 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter">${cashFlow.total.toLocaleString()}</h2>
            </div>
            
            <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-[2rem] space-y-3 shadow-lg">
                <p className="text-slate-500 font-black text-[12px] uppercase mb-4 tracking-widest text-center italic">Cifras del Sistema</p>
                <SimpleRow label="Efectivo" value={cashFlow.Efectivo} />
                <SimpleRow label="Transf." value={cashFlow.Transferencia} />
                <SimpleRow label="Tarjeta" value={cashFlow.Tarjeta} />
            </div>
        </div>
      </div>

      <div className="mt-12 space-y-6">
        <div className="flex items-center gap-3 px-4">
          <History className="text-indigo-500 w-5 h-5" />
          <h3 className="text-white font-black uppercase italic text-sm">Historial de Arqueos</h3>
        </div>
        
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-center text-slate-600 font-black uppercase italic text-xs py-10">No hay registros de arqueo</p>
          ) : (
            history.map((h) => {
              const isExpanded = expandedId === h.id;
              return (
                <div key={h.id} className={`bg-slate-900/40 border-2 transition-all rounded-[2rem] overflow-hidden ${isExpanded ? 'border-indigo-500/50 bg-slate-900/80 shadow-2xl' : 'border-slate-800'}`}>
                  <div className="p-5 flex items-center justify-between hover:bg-white/[0.02]">
                    <div 
                      onClick={() => setExpandedId(isExpanded ? null : h.id)} 
                      className="cursor-pointer flex-1 flex items-center gap-4 min-w-0"
                    >
                      <div className={`p-2 rounded-xl shrink-0 ${h.diferencia < 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {h.diferencia === 0 ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">{new Date(h.createdAt).toLocaleString()}</p>
                        <p className="text-white font-black italic uppercase text-sm truncate">{h.usuarioReporta}</p>
                      </div>
                    </div>
                    
                    <div className="text-right flex items-center gap-4 shrink-0">
                      <button 
                        onClick={(e) => { e.stopPropagation(); printAuditTicket(h); }} 
                        className="p-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-white/5 transition-all active:scale-90"
                      >
                        <Printer size={18} />
                      </button>
                      <div 
                        onClick={() => setExpandedId(isExpanded ? null : h.id)} 
                        className="cursor-pointer"
                      >
                        <p className="text-[10px] font-black text-slate-500 uppercase italic leading-none mb-1">Contado</p>
                        <p className="text-white font-black text-base italic leading-none">${h.totalFisico?.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-10 pb-6 pt-2 border-t border-slate-800/50 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-300">
                      <DetailBox label="Efectivo" esperado={h.esperado?.Efectivo} real={h.real?.Efectivo} />
                      <DetailBox label="Transferencia" esperado={h.esperado?.Transferencia} real={h.real?.Transferencia} />
                      <DetailBox label="Tarjeta" esperado={h.esperado?.Tarjeta} real={h.real?.Tarjeta} />
                      <div className="md:col-span-3 bg-slate-950 p-4 rounded-2xl flex justify-between items-center border border-white/5">
                         <span className="text-[10px] font-black text-slate-500 uppercase italic">Balance Final</span>
                         <span className={`font-black italic text-lg ${h.diferencia < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                          {h.diferencia > 0 ? '+' : ''}${h.diferencia?.toLocaleString()}
                         </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function ManualInput({ label, icon: Icon, value, onChange, expected }: any) {
  const diff = (Number(value) || 0) - expected;
  return (
    <div className="bg-slate-950/40 p-5 rounded-[1.8rem] border border-slate-800 group focus-within:border-indigo-500/40 transition-all">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-800 rounded-lg text-slate-500 group-focus-within:text-indigo-400 transition-colors"><Icon size={18} /></div>
            <span className="text-[13px] font-black text-slate-300 uppercase italic tracking-tighter">{label}</span>
        </div>
        <div className="text-right">
            <p className="text-[12px] font-bold text-slate-600 uppercase">Sistema</p>
            <p className="text-[20px] font-black text-white italic">${expected.toLocaleString()}</p>
        </div>
      </div>
      <div className="relative">
        <input 
            type="number" placeholder="0" value={value} 
            onChange={(e) => onChange(e.target.value)} 
            className="w-full bg-transparent border-b-2 border-slate-800 py-1 text-3xl font-black text-white outline-none focus:border-indigo-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
        />
        {value && (
            <div className={`absolute right-0 bottom-2 text-[13px] font-black px-3 py-1 rounded-full ${diff >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-500'}`}>
                {diff === 0 ? '✓ OK' : `${diff > 0 ? '+' : ''}${diff.toLocaleString()}`}
            </div>
        )}
      </div>
    </div>
  )
}

function SimpleRow({ label, value }: { label: string, value: number }) {
    return (
        <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-white/5">
            <span className="text-[12px] font-bold text-slate-500 uppercase">{label}</span>
            <span className="text-sm font-black text-white italic tracking-tight">${value.toLocaleString()}</span>
        </div>
    )
}

function DetailBox({ label, esperado, real }: any) {
  const diff = (Number(real) || 0) - esperado;
  return (
    <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
      <p className="text-[12px] font-black text-slate-200 uppercase mb-2 tracking-widest italic">{label}</p>
      <div className="flex justify-between items-end">
        <div>
          <p className="text-[12px] text-slate-600 uppercase font-bold">En Sistema</p>
          <span className="text-xs text-slate-400 font-bold">${esperado?.toLocaleString()}</span>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-slate-600 uppercase font-bold">En Caja</p>
          <span className="text-sm font-black text-white italic">${real?.toLocaleString()}</span>
        </div>
      </div>
      {real > 0 && (
        <p className={`text-[12px] font-black mt-2 text-right ${diff < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
          {diff === 0 ? '✓ OK' : `Dif: ${diff > 0 ? '+' : ''}${diff.toLocaleString()}`}
        </p>
      )}
    </div>
  )
}