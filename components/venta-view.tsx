'use client'

import { useEffect, useState } from 'react'
import { addMovement, savePendingMovement } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { useInventory } from '@/lib/inventory-context' // Importamos el contexto global
import { Botella } from '@/lib/types'
import { 
  Wine, Zap, History, Search, ShoppingCart, 
  RotateCcw, Layers, Loader2,
  GlassWater, Gift, ChevronUp, ChevronDown, X, CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner' 

export function VentaView() {
  const { user } = useAuth()
  const isPrivileged = user?.role === 'owner' 
  
  // 🔥 USO DEL CONTEXTO GLOBAL (Sincronización instantánea entre cajas)
  const { bottles, loading } = useInventory()

  const [search, setSearch] = useState('')
  const [isFinishing, setIsFinishing] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showFullCartMobile, setShowFullCartMobile] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Transferencia' | 'Tarjeta'>('Efectivo')
  const [transactionRef, setTransactionRef] = useState('')
  const [clientName, setClientName] = useState('')
  const [isCourtesy, setIsCourtesy] = useState(false)

  const [sessionSales, setSessionSales] = useState<{
    id: string, name: string, qty: number, tipo: string, precio: number
  }[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bar_session_sales')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  // Guardar carrito local para persistencia ante cierres accidentales
  useEffect(() => {
    localStorage.setItem('bar_session_sales', JSON.stringify(sessionSales))
  }, [sessionSales])

  const checkStockStatus = (item: Botella) => {
    const missingIngredients: string[] = [];

    if (item.tipo === 'botella') {
      if ((item.stockMl || 0) < (item.mlPorUnidad || 0)) {
        missingIngredients.push(item.nombre);
      }
    } else if (item.receta && item.receta.length > 0) {
      for (const ing of item.receta) {
        const insumo = bottles.find(b => b.id === ing.productId)
        if (!insumo || (Number(insumo.stockMl || 0)) < Number(ing.cantidad)) {
          missingIngredients.push(insumo?.nombre || "Insumo");
        }
      }
    }

    return { 
      available: missingIngredients.length === 0, 
      missingNames: missingIngredients 
    }
  }

  const handleQuickSale = (item: Botella) => {
    const { available, missingNames } = checkStockStatus(item)
    if (!available) {
      toast.error(`Falta stock de: ${missingNames.join(', ')}`)
      return
    }

    // Ya no editamos el estado local "bottles" porque el stock se refresca 
    // automáticamente desde Firebase via onSnapshot en el Contexto.

    setSessionSales(prev => {
      const exists = prev.find(s => s.id === item.id)
      if (exists) return prev.map(s => s.id === item.id ? { ...s, qty: s.qty + 1 } : s)
      return [...prev, { id: item.id, name: item.nombre, qty: 1, tipo: item.tipo, precio: item.precio }]
    })

    toast.success(`AÑADIDO: ${item.nombre}`, {
      icon: <CheckCircle2 className="text-emerald-500" size={18} />,
      duration: 800,
      className: "font-black uppercase italic text-[10px] tracking-tighter"
    })
  }

  const handleUndoLocal = (productId: string) => {
    setSessionSales(prev => prev.map(s => s.id === productId ? { ...s, qty: s.qty - 1 } : s).filter(s => s.qty > 0))
  }

  const printTicket = (ticketId: string) => {
    const total = isCourtesy ? 0 : sessionSales.reduce((acc, curr) => acc + (curr.qty * curr.precio), 0)
    const ticketWindow = window.open('', '_blank', 'width=300,height=600')
    if (!ticketWindow) return

    ticketWindow.document.write(`
      <html>
        <head>
          <style>
            body { font-family: 'Courier New', monospace; width: 80mm; padding: 10px; font-size: 12px; }
            .text-center { text-align: center; }
            .header { font-weight: bold; font-size: 16px; margin-bottom: 10px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .total { font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="text-center header">BUTIC</div>
          <div class="text-center">${isCourtesy ? 'INVITACIÓN / CORTESÍA' : 'Comprobante de Venta'}</div>
          <div class="text-center">${new Date().toLocaleString()}</div>
          <div class="divider"></div>
          ${sessionSales.map(item => `
            <div class="item">
              <span>${item.qty} x ${item.name.substring(0, 20)}</span>
              <span>$${(isCourtesy ? 0 : item.qty * item.precio).toLocaleString()}</span>
            </div>
          `).join('')}
          <div class="divider"></div>
          <div class="item">
            <span>MEDIO DE PAGO:</span>
            <span>${isCourtesy ? 'CORTESÍA' : paymentMethod.toUpperCase()}</span>
          </div>
          ${clientName ? `<div class="item"><span>CLIENTE:</span><span>${clientName.toUpperCase()}</span></div>` : ''}
          <div class="total">
            <span>TOTAL:</span>
            <span>$${total.toLocaleString()}</span>
          </div>
          <div class="divider"></div>
          <div class="text-center" style="font-size: 8px; margin-top: 10px;">Ticket: ${ticketId}</div>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `)
    ticketWindow.document.close()
  }

  const processFinalSale = async () => {
    if (!isCourtesy && paymentMethod !== 'Efectivo' && !transactionRef) {
      toast.error("Falta comprobante");
      return;
    }
    
    const ticketId = `TICK-${Date.now()}`;
    const timestamp = new Date().toISOString();
    setShowConfirmModal(false);
    setIsFinishing(true);
    printTicket(ticketId);

    const extraInfo = (paymentMethod !== 'Efectivo' && transactionRef) ? ` | Ref: ${transactionRef}` : '';
    const cliInfo = clientName ? ` | Cli: ${clientName}` : '';
    const paymentLabel = isCourtesy ? 'REGALO' : paymentMethod;
    
    const salesToSync = sessionSales.map(sale => ({
      botellaId: sale.id,
      nombreBotella: sale.name,
      tipo: 'venta',
      cantidad: sale.qty,
      monto: isCourtesy ? 0 : sale.precio * sale.qty,
      usuarioId: user?.id || 'admin',
      nombreUsuario: user?.name || 'Caja',
      notas: `Ticket: ${ticketId} | Pago: ${paymentLabel}${extraInfo}${cliInfo}`,
      createdAt: timestamp
    }));

    setSessionSales([]);
    localStorage.removeItem('bar_session_sales');

    try {
      const promises = salesToSync.map(m => 
        addMovement(m.botellaId, 'venta', m.cantidad, m.usuarioId, m.nombreUsuario, m.notas, timestamp)
      );
      await Promise.all(promises);
      toast.success(isCourtesy ? "Regalo registrado" : "Venta finalizada");
    } catch (e) {
      salesToSync.forEach(m => savePendingMovement(m));
      toast.warning("Guardado offline");
    } finally {
      setIsFinishing(false);
      setIsCourtesy(false);
      setShowFullCartMobile(false);
      setTransactionRef('');
      setClientName('');
      // No hace falta llamar a loadData(), el onSnapshot se encarga.
    }
  };

  const filteredItems = bottles.filter(b => 
    (b.nombre || "").toLowerCase().includes(search.toLowerCase()) || 
    (b.marca || "").toLowerCase().includes(search.toLowerCase())
  )

  const totalAmount = isCourtesy ? 0 : sessionSales.reduce((acc, curr) => acc + (curr.qty * curr.precio), 0)
  const totalItemsInComanda = sessionSales.reduce((acc, curr) => acc + curr.qty, 0)

  // Alerta de stock crítico para los cajeros
  const lowStockCount = bottles.filter(b => b.tipo === 'botella' && (b.stockMl || 0) <= (b.stockMinMl || 0)).length;

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#0f172a]">
       <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
    </div>
  )

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-8 font-rounded animate-in fade-in duration-500 overflow-hidden relative">
      
      {/* PANEL IZQUIERDO */}
      <div className="flex-[2] flex flex-col space-y-6 min-h-0 pb-32 lg:pb-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 px-2">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-500/20 rounded-[1.5rem] text-indigo-400"><Zap className="w-8 h-8 fill-current" /></div>
            <div>
              <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">VENTA</h1>
              {lowStockCount > 0 && (
                <p className="text-[10px] text-amber-500 font-bold uppercase mt-1 animate-pulse">Hay {lowStockCount} productos con stock bajo</p>
              )}
            </div>
          </div>
          <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full md:w-72 pl-6 pr-6 py-4 bg-slate-900/50 border-2 border-slate-800 rounded-[1.8rem] text-white outline-none focus:border-indigo-500 font-bold" />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-10 custom-scrollbar pb-10 px-2">
          {[
            { tipo: 'trago', label: 'Tragos y Recetas', icon: <GlassWater className="text-sky-400" /> },
            { tipo: 'combo', label: 'Combos y Promos', icon: <Layers className="text-purple-400" /> },
            { tipo: 'botella', label: 'Botellas y Unidades', icon: <Wine className="text-rose-400" /> }
          ].map((section) => {
            const items = filteredItems.filter(b => b.tipo === section.tipo && Number(b.precio) > 0)
            if (items.length === 0) return null
            return (
              <div key={section.tipo} className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  {section.icon}
                  <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic">{section.label}</h2>
                  <div className="flex-1 h-[1px] bg-slate-800" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items.map(bottle => (
                    <ItemButton 
                      key={bottle.id} 
                      bottle={bottle} 
                      status={checkStockStatus(bottle)} 
                      onClick={() => handleQuickSale(bottle)} 
                      variant={section.tipo as any} 
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* PANEL DERECHO: COMANDA */}
      <div className={`
        fixed bottom-0 left-0 right-0 z-40 transition-all duration-500 ease-in-out
        lg:relative lg:flex-1 lg:h-full lg:translate-y-0
        bg-slate-950 lg:bg-slate-900/30 border-t-4 lg:border-t-0 lg:border-2 border-slate-800 lg:rounded-[1rem] flex flex-col overflow-hidden shadow-2xl
        ${showFullCartMobile ? 'h-[80vh]' : 'h-20 lg:h-full'}
      `}>
        <div className="lg:hidden w-full flex justify-center py-2" onClick={() => setShowFullCartMobile(!showFullCartMobile)}>
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>

        <div className="p-4 lg:p-8 border-b-1 border-slate-800 bg-indigo-500/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-white uppercase tracking-widest text-xs italic">Comanda</h2>
            <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg">
              {totalItemsInComanda} ITEMS
            </span>
          </div>
          <div className="flex items-center gap-4">
            {sessionSales.length > 0 && (
               <button onClick={() => {setSessionSales([]); setIsCourtesy(false)}} className="text-rose-500 p-1 hover:bg-rose-500/10 rounded-lg"><RotateCcw size={20}/></button>
            )}
            <div className="lg:hidden" onClick={() => setShowFullCartMobile(!showFullCartMobile)}>
               {showFullCartMobile ? <ChevronDown className="text-slate-400" /> : <ChevronUp className="text-slate-400" />}
            </div>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar ${!showFullCartMobile && 'hidden lg:block'}`}>
          {sessionSales.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-800 space-y-4 opacity-20">
              <ShoppingCart className="w-16 h-16" /><p className="text-xs font-black uppercase italic">Vacío</p>
            </div>
          ) : (
            sessionSales.map((sale) => (
              <div key={sale.id} className="group flex items-center justify-between bg-slate-900/80 p-5 rounded-[2.2rem] border border-slate-800 transition-all">
                <div className="min-w-0 pr-4">
                  <p className="font-black text-slate-200 text-[11px] uppercase truncate italic">{sale.name}</p>
                  <p className="text-[15px] text-emerald-500 font-bold mt-1">${(sale.precio * sale.qty).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleUndoLocal(sale.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"><X size={18} /></button>
                  <div className="bg-indigo-600 text-white font-black px-4 py-2 rounded-2xl text-xl">x{sale.qty}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 lg:p-8 bg-slate-900 border-t-2 border-slate-800 shrink-0">
          {isPrivileged && sessionSales.length > 0 && (
            <button 
              onClick={() => setIsCourtesy(!isCourtesy)}
              className={`w-full mb-4 py-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase italic ${
                isCourtesy ? 'bg-purple-600 border-purple-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
            >
              <Gift size={16} />
              {isCourtesy ? 'REGALO ACTIVADO' : 'MARCAR COMO REGALO'}
            </button>
          )}

          <div className="flex justify-between items-end mb-6 px-2">
            <div className="flex flex-col">
              <span className="text-slate-500 font-bold uppercase text-[9px]">Total</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-black italic tracking-tighter transition-all ${isCourtesy ? 'text-purple-400 line-through opacity-40' : 'text-white'}`}>
                  ${totalAmount.toLocaleString()}
                </span>
                {isCourtesy && <span className="text-3xl font-black text-purple-400 italic animate-pulse">$0</span>}
              </div>
            </div>
          </div>

          <button 
            onClick={() => sessionSales.length > 0 && setShowConfirmModal(true)} 
            disabled={isFinishing || sessionSales.length === 0} 
            className={`w-full py-6 font-black rounded-[1.8rem] flex items-center justify-center gap-3 transition-all text-xl uppercase italic shadow-2xl active:scale-95 disabled:opacity-30 ${isCourtesy ? 'bg-purple-600 text-white' : 'bg-emerald-600 text-white'}`}
          >
            {isFinishing ? <Loader2 size={24} className="animate-spin" /> : isCourtesy ? <Gift /> : <Zap className="fill-current" />} 
            {isFinishing ? 'Cargando...' : isCourtesy ? 'Confirmar Regalo' : 'Finalizar Venta'}
          </button>
        </div>
      </div>

      {/* MODAL CONFIRMACIÓN */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[999] flex items-end lg:items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-t-[3rem] lg:rounded-[3rem] w-full max-w-md p-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <h2 className="text-2xl font-black text-white uppercase italic text-center mb-8">
              {isCourtesy ? 'Confirmar Regalo' : 'Confirmar Cobro'}
            </h2>
            
            {!isCourtesy && (
              <div className="grid grid-cols-3 gap-3 mb-8">
                {['Efectivo', 'Transferencia', 'Tarjeta'].map((m) => (
                  <button key={m} onClick={() => setPaymentMethod(m as any)} className={`p-4 rounded-2xl border-2 transition-all ${paymentMethod === m ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-800/50 border-slate-700 text-slate-500'}`}>
                    <span className="text-[8px] font-black uppercase">{m}</span>
                  </button>
                ))}
              </div>
            )}
            
            <div className="space-y-4 mb-6">
               {!isCourtesy && paymentMethod !== 'Efectivo' && (
                 <input type="text" placeholder="Nº Transacción / Ref" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} className="w-full bg-slate-950 border-2 border-slate-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-indigo-500" />
               )}
               <input type="text" placeholder="Nombre del Cliente (Opcional)" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full bg-slate-950 border-2 border-slate-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-indigo-500" />
            </div>

            <div className="flex w-full gap-3">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-4 bg-slate-800 text-slate-400 font-black rounded-2xl uppercase text-[10px]">Cerrar</button>
              <button onClick={processFinalSale} className={`flex-[2] py-4 font-black rounded-2xl uppercase text-[10px] transition-all ${isCourtesy ? 'bg-purple-600 text-white' : 'bg-emerald-600 text-white'}`}>
                {isCourtesy ? 'Confirmar Regalo' : 'Confirmar Venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ItemButton({ bottle, status, onClick, variant }: { bottle: Botella, status: { available: boolean, missingNames: string[] }, onClick: () => void, variant: any }) {
  const Icon = (variant === 'receta' || variant === 'trago') ? GlassWater : variant === 'combo' ? Layers : Wine
  const isOut = !status.available
  
  const isBottle = bottle.tipo === 'botella';
  const stockActual = Number(bottle.stockMl || 0);
  const stockMinimo = Number(bottle.stockMinMl || 0);
  
  const isLow = !isOut && isBottle && stockMinimo > 0 && stockActual <= stockMinimo;

  const activeColor = isOut ? 'rose' : isLow ? 'amber' : (variant === 'receta' || variant === 'trago') ? 'sky' : variant === 'combo' ? 'purple' : 'rose'

  return (
    <button 
      disabled={isOut} 
      onClick={onClick} 
      className={`group relative aspect-square rounded-[2.2rem] border-2 transition-all active:scale-95 flex flex-col items-center justify-center p-4 text-center ${
        isOut 
        ? 'bg-slate-900/20 border-rose-500/20 grayscale cursor-not-allowed' 
        : isLow 
          ? 'bg-amber-500/5 border-amber-500/40 shadow-lg' 
          : `bg-slate-900/40 border-${activeColor}-500/20 hover:border-${activeColor}-500 shadow-xl`
      }`}
    >
      {isLow && (
        <span className="absolute top-4 right-4 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
      )}

      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 mb-3 transition-colors ${
        isOut ? 'bg-rose-500/10 border-rose-500/20 text-rose-500/40' : `bg-slate-800/50 border-slate-700 text-${activeColor}-400`
      }`}>
        <Icon className="w-6 h-6" />
      </div>

      <div className="min-w-0 w-full px-1">
        <p className={`font-bold text-[10px] uppercase leading-tight truncate italic ${isOut ? 'text-slate-500 opacity-60' : 'text-white'}`}>
          {bottle.nombre}
        </p>

        {isOut ? (
          <div className="mt-2 flex flex-col items-center gap-1">
            <span className="text-[7px] font-black text-rose-500 uppercase tracking-tighter leading-none">Falta:</span>
            <span className="text-[8px] font-black text-rose-400 uppercase truncate w-full italic">
              {status.missingNames[0] || 'Insumo'}
            </span>
          </div>
        ) : (
          <p className={`text-[15px] font-black mt-2 uppercase tracking-tighter ${isLow ? 'text-amber-500' : 'text-slate-500'}`}>
            ${bottle.precio?.toLocaleString()}
          </p>
        )}
      </div>
    </button>
  )
}