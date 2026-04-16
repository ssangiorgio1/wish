'use client'

import { useEffect, useState } from 'react'
import { getBottles, addMovement, getAlerts, markAlertAsRead } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { Botella, Alerta, CategoriaProducto } from '@/lib/types'
import { 
  Truck, Plus, Trash2, Save, PackageCheck, 
  Search, ShoppingCart, Loader2, FileText, Bell, Check, Droplets,
  ChevronUp, ChevronDown, RotateCcw, X, Filter
} from 'lucide-react'
import { toast } from 'sonner'

// Definimos las categorías para el filtro
const CATEGORIES: { value: CategoriaProducto | 'all', label: string, icon: string }[] = [
  { value: 'all', label: 'Todas', icon: '📁' },
  { value: 'whisky', label: 'Whiskies', icon: '🥃' },
  { value: 'vodka', label: 'Vodkas', icon: '🍸' },
  { value: 'ron/licor', label: 'Ron/Licor', icon: '🍹' },
  { value: 'tequila', label: 'Tequilas', icon: '🌵' },
  { value: 'gin', label: 'Gins', icon: '🌿' },
  { value: 'cerveza', label: 'Cervezas', icon: '🍺' },
  { value: 'vino', label: 'Vinos', icon: '🍷' },
  { value: 'champagne', label: 'Champagnes', icon: '🥂' },
  { value: 'Gaseosa', label: 'Gaseosas', icon: '🥤' },
  { value: 'otros', label: 'Otros', icon: '🎁' },
]

export default function EntranteView() {
  const { user } = useAuth()
  const [bottles, setBottles] = useState<Botella[]>([])
  const [alerts, setAlerts] = useState<Alerta[]>([])
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<CategoriaProducto | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [nota, setNota] = useState('')
  const [showFullCartMobile, setShowFullCartMobile] = useState(false)

  // Carrito de compras local
  const [cart, setCart] = useState<{id: string, name: string, qty: number, cost: number}[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bar_incoming_cart')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  const loadData = async () => {
    try {
      const [bottlesData, alertsData] = await Promise.all([
        getBottles(),
        getAlerts()
      ])
      setBottles(bottlesData.filter(b => b.tipo === 'botella'))
      setAlerts((alertsData as Alerta[]).filter(a => !a.leida))
    } catch (error) {
      console.error("Error al sincronizar datos:", error)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadData()
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    localStorage.setItem('bar_incoming_cart', JSON.stringify(cart))
  }, [cart])

  const addToCart = (bottle: Botella) => {
    const exists = cart.find(item => item.id === bottle.id)
    if (!exists) {
      setCart([...cart, { 
        id: bottle.id, 
        name: bottle.nombre, 
        qty: 1, 
        cost: bottle.precioCosto || 0 
      }])
      toast.success(`${bottle.nombre} listo para ingreso`)
    } else {
      toast.info("Ya está en la lista")
    }
  }

  const updateItem = (id: string, field: 'qty' | 'cost', value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    setCart(cart.map(item => item.id === id ? { ...item, [field]: numValue } : item))
  }

  const handleMarkAsRead = async (id: string) => {
    const success = await markAlertAsRead(id)
    if (success) {
      setAlerts(prev => prev.filter(a => a.id !== id))
    }
  }

  const handleFinalize = async () => {
    
    if (isSaving) return

    if (cart.length === 0) {
        toast.warning("El carrito está vacío", {
            description: "Agregá productos antes de confirmar el ingreso."
        });
        return;
    }

    
    if (!nota.trim()) {
      
        toast.error("Falta Número de Remito", {
            description: "Es obligatorio ingresar el remito o proveedor para continuar.",
            duration: 4000,
        });
        return;
    }

    const toastId = toast.loading("Generando lote de ingreso...")
    setIsSaving(true)
    
    try {
      const batchId = `LOTE-${Date.now()}`;
      const timestamp = new Date().toISOString();

      const promises = cart.map(item => 
        addMovement(
          item.id,
          'entrada',
          item.qty,
          user?.id || 'anon',
          user?.name || 'Sistema',
          nota,
          timestamp,
          item.cost,
          batchId
        )
      )

      await Promise.all(promises)
      
      setCart([])
      setNota('')
      localStorage.removeItem('bar_incoming_cart')
      setShowFullCartMobile(false)
      await loadData() 
      
      toast.success("¡Procesado correctamente!", { id: toastId })

    } catch (error) {
      console.error(error)
      toast.error("Error al procesar el ingreso", { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }

  const filteredBottles = bottles.filter(b => {
    const matchesSearch = (b.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
                         (b.marca || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'all' || b.categoria === filterCategory;
    return matchesSearch && matchesCategory;
  })

  const totalInvestment = cart.reduce((acc, curr) => acc + (curr.qty * curr.cost), 0)
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

  if (loading) return (
    <div className="h-[80vh] flex flex-col items-center justify-center gap-4 text-slate-500 font-black italic text-xs uppercase">
      <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
      Cargando Manifiesto...
    </div>
  )

  return (
    <div className="h-[calc(90vh-10px)] flex flex-col lg:flex-row gap-8 font-rounded animate-in fade-in duration-500 overflow-hidden relative">
      
      {/* PANEL IZQUIERDO: BÚSQUEDA Y SELECCIÓN */}
      <div className="flex-[1.2] flex flex-col space-y-4 min-h-0 pb-24 lg:pb-0">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Recepción</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Suma de Unidades al Inventario</p>
            </div>
          </div>
        </div>

        {/* ALERTAS CRÍTICAS */}
        {alerts.length > 0 && (
          <div className="space-y-2 px-2">
             <div className="flex items-center gap-2 mb-1">
                <Bell className="w-3 h-3 text-rose-500 animate-bounce" />
                <span className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em]">Prioridad de Compra</span>
             </div>
             <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {alerts.map(alert => (
                  <div key={alert.id} className="flex-shrink-0 bg-rose-500/10 border border-rose-500/30 p-3 rounded-2xl flex items-center gap-4">
                    <div className="min-w-0">
                      <p className="text-white font-black text-[10px] uppercase truncate w-32 italic">{alert.nombreBotella}</p>
                    </div>
                    <button onClick={() => handleMarkAsRead(alert.id)} className="p-1.5 bg-rose-500 text-white rounded-lg">
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ))}
             </div>
          </div>
        )}

        <div className="flex flex-col gap-3 px-2">
          {/* BUSCADOR */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" placeholder="Buscar producto..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-4 bg-slate-900/50 border-2 border-slate-800 rounded-[1.5rem] text-white outline-none focus:border-indigo-500/50 font-bold"
            />
          </div>

          {/* FILTRO POR CATEGORÍA */}
          <div className="flex items-center gap-2 bg-slate-950/50 p-2 rounded-2xl border border-slate-800">
            <Filter size={14} className="text-indigo-400 ml-2 shrink-0" />
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value as any)}
              className="bg-transparent text-white font-black text-[10px] uppercase outline-none flex-1 appearance-none cursor-pointer"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value} className="bg-slate-900">
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="text-slate-500 mr-2" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar px-2">
          {filteredBottles.length === 0 ? (
            <div className="py-20 text-center opacity-20">
              <PackageCheck className="w-12 h-12 mx-auto mb-2" />
              <p className="font-black uppercase text-[10px]">No se encontraron productos</p>
            </div>
          ) : (
            filteredBottles.map(bottle => {
              const stockVisual = bottle.mlPorUnidad > 0 ? (bottle.stockMl / bottle.mlPorUnidad).toFixed(1) : '0';
              const isLow = bottle.stockMl <= bottle.stockMinMl;

              return (
                <button key={bottle.id} onClick={() => addToCart(bottle)} className="w-full flex items-center justify-between p-4 bg-slate-900/30 border-2 border-slate-800 hover:border-indigo-500/50 rounded-2xl transition-all group active:scale-[0.98]">
                  <div className="text-left">
                    <p className="font-bold text-white text-sm uppercase italic">{bottle.nombre}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-[12px] text-slate-500 font-bold uppercase">{bottle.marca}</p>
                      <div className={`flex items-center gap-1 text-[12px] font-black px-2 py-0.5 rounded-md ${isLow ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-800 text-slate-400'}`}>
                        <Droplets className="w-2 h-2" />
                        {stockVisual} botellas
                      </div>
                    </div>
                  </div>
                  <Plus className="w-5 h-5 text-slate-600 group-hover:text-indigo-400" />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* PANEL DERECHO: ESTILO "FLOATING SHEET" EN MOBILE */}
      <div className={`
        fixed transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
        lg:relative lg:flex-1 lg:h-full lg:translate-y-0 lg:z-10 lg:inset-0
        bg-[#0a0f1a]/95 backdrop-blur-xl lg:bg-slate-900/40 border-2 border-slate-800 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden
        ${showFullCartMobile 
          ? 'bottom-2 left-2 right-2 top-2 z-[100] rounded-[2.5rem]' 
          : 'bottom-4 left-4 right-4 h-16 z-[100] rounded-2xl lg:rounded-[3rem]'}
      `}>
        
        {/* MANIJA TÁCTIL */}
        <div 
          className="lg:hidden w-full flex justify-center py-5 cursor-pointer shrink-0" 
          onClick={() => setShowFullCartMobile(!showFullCartMobile)}
        >
          <div className={`w-12 h-1.5 rounded-full transition-all duration-500 ${showFullCartMobile ? 'bg-slate-700 w-8' : 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]'}`} />
        </div>

        {/* HEADER DETALLE */}
        <div className={`
          px-6 pb-4 pt-1 lg:p-8 border-b-2 border-slate-800/50 bg-emerald-500/5 flex items-center justify-between shrink-0
          ${!showFullCartMobile ? 'h-full lg:h-auto' : ''}
        `}>
          <div className="flex items-center gap-3">
            <PackageCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="font-black text-white uppercase text-[10px] lg:text-sm italic tracking-widest">Detalle Ingreso</h2>
          </div>
          <div className="flex items-center gap-4">
            {cart.length > 0 && (
              <span className="text-[10px] font-black bg-emerald-500 text-black px-2 py-0.5 rounded-lg uppercase italic">
                {cart.length}
              </span>
            )}
          </div>
        </div>

        {/* LISTA DE ITEMS */}
        <div className={`flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar ${!showFullCartMobile && 'hidden lg:block'}`}>
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-20">
              <ShoppingCart className="w-12 h-12 mb-4" />
              <p className="font-black italic text-[10px] uppercase text-center tracking-widest">Lista vacía</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="bg-slate-950/50 p-4 rounded-[1.8rem] border border-slate-800/50 space-y-4 shadow-inner">
                <div className="flex justify-between items-center px-1">
                  <p className="font-black text-slate-200 text-xs uppercase truncate flex-1 italic">{item.name}</p>
                  <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="p-2 text-rose-500/50 hover:text-rose-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <label className="text-[12px] font-black text-slate-600 uppercase mb-1 block">Botellas</label>
                    <input 
                      type="number" step="0.1" value={item.qty === 0 ? '' : item.qty} 
                      onFocus={handleFocus}
                      onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 text-white font-black text-center text-lg outline-none focus:border-indigo-500" 
                    />
                  </div>
                  <div className="text-center">
                    <label className="text-[12px] font-black text-slate-600 uppercase mb-1 block">Costo Unit.</label>
                    <input 
                      type="number" value={item.cost === 0 ? '' : item.cost}
                      onFocus={handleFocus}
                      onChange={(e) => updateItem(item.id, 'cost', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 text-emerald-400 font-black text-center text-lg outline-none focus:border-emerald-500" 
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER ACCIONES */}
        <div className={`p-5 lg:p-8 bg-slate-900/80 backdrop-blur-md border-t-2 border-slate-800 space-y-4 shrink-0 ${!showFullCartMobile && 'hidden lg:block'}`}>
          <div className="relative group">
            <FileText className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${!nota.trim() ? 'text-rose-500' : 'text-slate-600 group-focus-within:text-indigo-400'}`} />
            <input 
              type="text" 
              placeholder="Número de Remito / Proveedor (OBLIGATORIO)" 
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className={`w-full pl-11 pr-4 py-3 bg-slate-950 border rounded-xl text-[10px] text-white font-bold outline-none uppercase transition-all ${!nota.trim() ? 'border-rose-500/50 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500/50'}`}
            />
          </div>

          <div className="flex justify-between items-center px-1">
            <span className="text-slate-500 font-black uppercase text-[10px] tracking-widest">Inversión Total</span>
            <span className="text-2xl font-black text-white italic tracking-tighter">${totalInvestment.toLocaleString()}</span>
          </div>

          <button 
          onClick={handleFinalize} 
          disabled={isSaving} 
          className={`w-full py-4 ${isSaving ? 'bg-slate-800 text-slate-600' : 'bg-emerald-600 text-white shadow-lg active:scale-95'} font-black rounded-2xl flex items-center justify-center gap-3 text-base uppercase italic transition-all`}
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Confirmar Ingreso
        </button>
        </div>
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}