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

  // ✅ TICKET LIMPIO SIN HEADERS DE GOOGLE
  const printAuditTicket = (data: any) => {
    const ticketWindow = window.open('', '_blank');
    if (!ticketWindow) return;

    ticketWindow.document.write(`
      <html>
        <head>
          <title>Ticket Arqueo - BUTIC</title>
          <style>
            @page { size: auto; margin: 0mm; }
            body { 
              font-family: 'Courier New', monospace; 
              width: 80mm; 
              padding: 10mm; 
              font-size: 12px; 
              color: #000;
            }
            .text-center { text-align: center; }
            .header { font-weight: bold; font-size: 18px; margin-bottom: 5px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .bold { font-weight: bold; }
            .footer { font-size: 9px; margin-top: 20px; opacity: 0.7; }
            @media print {
              header, footer { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="text-center header">BUTIC</div>
          <div class="text-center">CIERRE DE JORNADA</div>
          <div class="text-center">${new Date(data.createdAt).toLocaleString('es-AR')}</div>
          <div class="divider"></div>
          <div class="row"><span class="bold">TERMINAL:</span> <span>${data.terminal.toUpperCase()}</span></div>
          <div class="row"><span class="bold">CAJERO:</span> <span>${data.usuarioReporta}</span></div>
          <div class="divider"></div>
          <div class="text-center bold" style="margin-bottom: 8px;">VALORES DECLARADOS</div>
          <div class="row"><span>Efectivo:</span> <span>$${data.real.Efectivo.toLocaleString('es-AR')}</span></div>
          <div class="row"><span>Transferencia:</span> <span>$${data.real.Transferencia.toLocaleString('es-AR')}</span></div>
          <div class="row"><span>Tarjeta:</span> <span>$${data.real.Tarjeta.toLocaleString('es-AR')}</span></div>
          <div class="divider"></div>
          <div class="row bold" style="font-size: 14px;">
            <span>TOTAL CONTADO:</span> 
            <span>$${data.totalFisico.toLocaleString('es-AR')}</span>
          </div>
          <div class="divider"></div>
          <div class="text-center" style="margin-top: 40px; border-top: 1px solid #000; width: 60%; margin-left: 20%;">
            Firma Responsable
          </div>
          <div class="footer text-center">ID: ${data.id?.substring(0,8)}</div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    ticketWindow.document.close();
  };

  const handleSaveAudit = async () => {
    // Limpiamos los strings de puntos para convertir a número
    const parseFormatted = (val: string) => Number(val.replace(/\./g, '')) || 0;

    const realEf = parseFormatted(manualCash.efectivo);
    const realTr = parseFormatted(manualCash.transferencia);
    const realTa = parseFormatted(manualCash.tarjeta);

    if (realEf === 0 && realTr === 0 && realTa === 0) {
        return toast.error("Ingresá los valores contados en caja");
    }
    
    setSavingAudit(true);
    try {
        const totalReal = realEf + realTr + realTa;
        const auditData = {
            terminal: cashUserFilter,
            esperado: {
              Efectivo: cashFlow.Efectivo,
              Transferencia: cashFlow.Transferencia,
              Tarjeta: cashFlow.Tarjeta,
              total: cashFlow.total
            },
            real: { Efectivo: realEf, Transferencia: realTr, Tarjeta: realTa },
            totalFisico: totalReal,
            diferencia: totalReal - cashFlow.total,
            usuarioReporta: user?.name || 'Sistema',
            createdAt: new Date().toISOString()
        };

        const res = await saveCashAudit(auditData);
        
        if (res) {
          toast.success("Jornada cerrada correctamente");
          printAuditTicket({...auditData, id: res.id}); 
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
      
      {/* HEADER */}
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
                    <ManualInput label="Efectivo" icon={Banknote} value={manualCash.efectivo} onChange={(v: string) => setManualCash({...manualCash, efectivo: v})} expected={cashFlow.Efectivo} isAdmin={isAdmin} />
                    <ManualInput label="Transferencia" icon={Landmark} value={manualCash.transferencia} onChange={(v: string) => setManualCash({...manualCash, transferencia: v})} expected={cashFlow.Transferencia} isAdmin={isAdmin} />
                    <ManualInput label="Tarjeta / POS" icon={CreditCard} value={manualCash.tarjeta} onChange={(v: string) => setManualCash({...manualCash, tarjeta: v})} expected={cashFlow.Tarjeta} isAdmin={isAdmin} />
                </div>

                <button 
                    onClick={handleSaveAudit} 
                    disabled={savingAudit || (isAdmin ? false : cashFlow.total === 0)} 
                    className="w-full mt-8 py-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl rounded-3xl shadow-2xl uppercase italic flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-20"
                >
                    {savingAudit ? <Loader2 className="animate-spin" /> : <ArrowDownCircle size={24} />} 
                    Finalizar Jornada e Imprimir Ticket
                </button>
            </div>
        </div>

        {/* RESUMEN DERECHA */}
        <div className="space-y-6">
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <Banknote className="absolute -right-4 -bottom-4 w-32 h-32 text-white opacity-10" />
                <p className="text-indigo-200 font-black uppercase text-[10px] mb-2 tracking-widest italic">{isAdmin ? 'Total en Sistema' : 'Estado de Caja'}</p>
                <h2 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter">
                  {isAdmin ? `$${cashFlow.total.toLocaleString('es-AR')}` : "CAJA ACTIVA"}
                </h2>
            </div>
            
            {isAdmin && (
              <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-[2rem] space-y-3 shadow-lg">
                  <p className="text-slate-500 font-black text-[12px] uppercase mb-4 tracking-widest text-center italic">Cifras del Sistema</p>
                  <SimpleRow label="Efectivo" value={cashFlow.Efectivo} />
                  <SimpleRow label="Transf." value={cashFlow.Transferencia} />
                  <SimpleRow label="Tarjeta" value={cashFlow.Tarjeta} />
              </div>
            )}
        </div>
      </div>

      {/* HISTORIAL */}
      <div className="mt-12 space-y-6">
        <div className="flex items-center gap-3 px-4">
          <History className="text-indigo-500 w-5 h-5" />
          <h3 className="text-white font-black uppercase italic text-sm">Historial de Arqueos</h3>
        </div>
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-center text-slate-600 font-black uppercase italic text-xs py-10">No hay registros</p>
          ) : (
            history.map((h) => {
              const isExpanded = expandedId === h.id;
              return (
                <div key={h.id} className={`bg-slate-900/40 border-2 transition-all rounded-[2rem] overflow-hidden ${isExpanded ? 'border-indigo-500/50 bg-slate-900/80 shadow-2xl' : 'border-slate-800'}`}>
                  <div className="p-5 flex items-center justify-between hover:bg-white/[0.02]">
                    <div onClick={() => setExpandedId(isExpanded ? null : h.id)} className="cursor-pointer flex-1 flex items-center gap-4">
                      <div className={`p-2 rounded-xl ${h.diferencia < 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {h.diferencia === 0 ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">{new Date(h.createdAt).toLocaleString('es-AR')}</p>
                        <p className="text-white font-black italic uppercase text-sm">{h.terminal === 'todos' ? 'CIERRE GLOBAL' : `CAJA: ${h.terminal}`}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <button onClick={(e) => { e.stopPropagation(); printAuditTicket(h); }} className="p-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-white/5"><Printer size={18} /></button>
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase italic mb-1 leading-none">Declarado</p>
                        <p className="text-white font-black text-base italic leading-none">${h.totalFisico?.toLocaleString('es-AR')}</p>
                      </div>
                    </div>
                  </div>
                  {isExpanded && isAdmin && (
                    <div className="px-10 pb-6 pt-2 border-t border-slate-800/50 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2">
                      <DetailBox label="Efectivo" esperado={h.esperado?.Efectivo} real={h.real?.Efectivo} />
                      <DetailBox label="Transferencia" esperado={h.esperado?.Transferencia} real={h.real?.Transferencia} />
                      <DetailBox label="Tarjeta" esperado={h.esperado?.Tarjeta} real={h.real?.Tarjeta} />
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

function ManualInput({ label, icon: Icon, value, onChange, expected, isAdmin }: any) {
  // Lógica para poner puntos de mil mientras escribe
  const formatValue = (val: string) => {
    const raw = val.replace(/\D/g, ''); // Quitamos todo lo que no sea número
    return raw.replace(/\B(?=(\d{3})+(?!\d))/g, "."); // Ponemos los puntos
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(formatValue(e.target.value));
  };

  const numericValue = Number(value.replace(/\./g, '')) || 0;
  const diff = numericValue - expected;
  
  return (
    <div className="bg-slate-950/40 p-5 rounded-[1.8rem] border border-slate-800 group focus-within:border-indigo-500/40 transition-all">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-800 rounded-lg text-slate-500 group-focus-within:text-indigo-400 transition-colors"><Icon size={18} /></div>
            <span className="text-[13px] font-black text-slate-300 uppercase italic tracking-tighter">{label}</span>
        </div>
        {isAdmin && (
          <div className="text-right">
              <p className="text-[12px] font-bold text-slate-600 uppercase">Sistema</p>
              <p className="text-[20px] font-black text-white italic">${expected.toLocaleString('es-AR')}</p>
          </div>
        )}
      </div>
      <div className="relative">
        <input 
            type="text" // Cambiado a text para soportar los puntos visuales
            inputMode="numeric"
            placeholder="0" 
            value={value} 
            onChange={handleChange} 
            className="w-full bg-transparent border-b-2 border-slate-800 py-1 text-3xl font-black text-white outline-none focus:border-indigo-500 transition-colors" 
        />
        {isAdmin && value && (
            <div className={`absolute right-0 bottom-2 text-[13px] font-black px-3 py-1 rounded-full ${diff >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-500'}`}>
                {diff === 0 ? '✓ OK' : `${diff > 0 ? '+' : ''}${diff.toLocaleString('es-AR')}`}
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
            <span className="text-sm font-black text-white italic tracking-tight">${value.toLocaleString('es-AR')}</span>
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
          <p className="text-[12px] text-slate-600 uppercase font-bold">Sistema</p>
          <span className="text-xs text-slate-400 font-bold">${esperado?.toLocaleString('es-AR')}</span>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-slate-600 uppercase font-bold">Caja</p>
          <span className="text-sm font-black text-white italic">${real?.toLocaleString('es-AR')}</span>
        </div>
      </div>
      <p className={`text-[12px] font-black mt-2 text-right ${diff < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
        {diff === 0 ? '✓ OK' : `Dif: ${diff > 0 ? '+' : ''}${diff.toLocaleString('es-AR')}`}
      </p>
    </div>
  )
}