'use client'

import { useEffect, useState } from 'react'
import { addBottle, updateBottle } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { useInventory } from '@/lib/inventory-context' // Importamos el nuevo contexto
import { Botella, CategoriaProducto } from '@/lib/types'
import { 
  Plus, Search, Edit2, X, Wine, 
  Layers, Loader2, Beaker, FileSpreadsheet, 
  LayoutGrid, List, Save, CheckCircle2, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

const CATEGORIES: { value: CategoriaProducto, label: string, icon: string }[] = [
  { value: 'whisky', label: 'Whiskies', icon: '🥃' },
  { value: 'vodka', label: 'Vodkas', icon: '🍸' },
  { value: 'ron/licor', label: 'Ron / Licores', icon: '🍹' },
  { value: 'tequila', label: 'Tequilas', icon: '🌵' },
  { value: 'gin', label: 'Gins', icon: '🌿' },
  { value: 'cerveza', label: 'Cervezas', icon: '🍺' },
  { value: 'vino', label: 'Vinos', icon: '🍷' },
  { value: 'champagne', label: 'Champagnes', icon: '🥂' },
  { value: 'Gaseosa', label: 'Gaseosas', icon: '🥤' },
  { value: 'Trago', label: 'Tragos', icon: '🍹' },
  { value: 'Combo', label: 'Combos', icon: '📦' },
  { value: 'otros', label: 'Otros', icon: '🎁' },
]

export function InventoryView() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'
  
  // 🔥 USO DEL CONTEXTO GLOBAL (Tiempo real)
  const { bottles, loading } = useInventory()

  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStock, setFilterStock] = useState<'all' | 'available' | 'low_stock'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingBottle, setEditingBottle] = useState<Botella | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [searchInsumo, setSearchInsumo] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const [unitsText, setUnitsText] = useState('')
  const [minUnitsText, setMinUnitsText] = useState('')

  const initialForm = {
    nombre: '', categoria: 'whisky', marca: '', tipo: 'botella',
    mlPorUnidad: 750, stockMl: 0, stockMinMl: 750, precio: 0, precioCosto: 0, 
    graduacion: 0, receta: [], capacidadVaso: 0
  }
  const [formData, setFormData] = useState<any>(initialForm)

  // Sincronizar los textos de los inputs cuando se abre el modal o cambia la botella
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden'
      const u = formData.mlPorUnidad > 0 ? (Number(formData.stockMl || 0) / Number(formData.mlPorUnidad)).toFixed(1) : '0'
      const m = formData.mlPorUnidad > 0 ? (Number(formData.stockMinMl || 0) / Number(formData.mlPorUnidad)).toFixed(1) : '0'
      setUnitsText(u)
      setMinUnitsText(m)
    } else {
      document.body.style.overflow = 'unset'
    }
  }, [showModal, formData.mlPorUnidad, editingBottle])

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const toastId = toast.loading("Procesando archivo Excel...")
    setIsImporting(true)
    
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const data = XLSX.read(evt.target?.result, { type: 'binary' })
        const rows: any[] = XLSX.utils.sheet_to_json(data.Sheets[data.SheetNames[0]])
        
        let count = 0;
        for (const row of rows) {
          const recetaProcesada: any[] = []
          const tipoExcel = String(row.Tipo || 'botella').toLowerCase()
          
          if (row.Ingredientes && (tipoExcel === 'trago' || tipoExcel === 'combo')) {
            const items = String(row.Ingredientes).split(',')
            items.forEach(itemStr => {
              const [nombreInsumo, cantidad] = itemStr.split(':')
              if (nombreInsumo && cantidad) {
                const insumo = bottles.find(b => b.nombre.trim().toUpperCase() === nombreInsumo.trim().toUpperCase())
                if (insumo) recetaProcesada.push({ productId: insumo.id, cantidad: Number(cantidad.trim()) })
              }
            })
          }
          
          await addBottle({
            nombre: String(row.Nombre || "").toUpperCase(),
            marca: String(row.Marca || "GENERICA").toUpperCase(),
            categoria: (row.Categoria || "otros") as any,
            tipo: tipoExcel as any,
            capacidadVaso: Number(row.CapacidadVaso || 0),
            mlPorUnidad: tipoExcel === 'botella' ? Number(row.CapacidadMl || 0) : Number(row.CapacidadVaso || 0),
            precio: Number(row.PrecioVenta || 0),
            precioCosto: Number(row.PrecioCosto || 0),
            stockMl: tipoExcel === 'botella' ? (Number(row.StockUnidades || 0) * Number(row.CapacidadMl || 1)) : 0,
            stockMinMl: tipoExcel === 'botella' ? (Number(row.MinimoAviso || 1) * Number(row.CapacidadMl || 1)) : 0,
            receta: recetaProcesada,
            createdAt: new Date().toISOString()
          } as any)
          count++;
        }
        
        toast.success(`${count} productos importados correctamente`, { id: toastId })
      } catch (err) { 
        toast.error("Error al procesar el archivo Excel", { id: toastId }) 
      } finally { 
        setIsImporting(false)
        e.target.value = "" 
      }
    }
    reader.readAsBinaryString(file)
  }

  const calcularCostoReceta = () => {
    if ((formData.tipo === 'trago' || formData.tipo === 'combo') && formData.receta) {
      return formData.receta.reduce((total: number, item: any) => {
        const insumo = bottles.find(b => b.id === item.productId);
        if (!insumo) return total;
        let costoInsumo = 0;
        if (formData.tipo === 'trago') {
          costoInsumo = (Number(item.cantidad) * (Number(insumo.precioCosto || 0) / Number(insumo.mlPorUnidad || 1)));
        } else {
          costoInsumo = Number(item.cantidad) * Number(insumo.precioCosto || 0);
        }
        return total + costoInsumo;
      }, 0);
    }
    return Number(formData.precioCosto || 0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const loadingToast = toast.loading(editingBottle ? "Actualizando producto..." : "Guardando producto...")
    
    try {
        const dataToSave = {
            ...formData,
            nombre: formData.nombre.toUpperCase(),
            marca: formData.marca.toUpperCase(),
            precioCosto: formData.tipo !== 'botella' ? calcularCostoReceta() : Number(formData.precioCosto),
            stockMl: formData.tipo === 'botella' ? Number(formData.stockMl) : 0,
        }
        
        if (editingBottle) {
            await updateBottle(editingBottle.id, dataToSave)
            toast.success("Producto actualizado", { id: loadingToast })
        } else {
            await addBottle(dataToSave)
            toast.success("Producto creado", { id: loadingToast })
        }
        
        setShowModal(false)
    } catch (error) {
        toast.error("Error al guardar", { id: loadingToast })
    }
  }

  const calcularGraduacionFinal = () => {
    if (formData.tipo !== 'trago' || !formData.capacidadVaso || Number(formData.capacidadVaso) === 0) return 0;
    let mlAlcoholPuro = 0;
    formData.receta.forEach((r: any) => {
      const insumo = bottles.find(b => b.id === r.productId);
      if (insumo && insumo.graduacion) {
        mlAlcoholPuro += (Number(r.cantidad) * (Number(insumo.graduacion) / 100));
      }
    });
    return ((mlAlcoholPuro / Number(formData.capacidadVaso)) * 100).toFixed(1);
  }

  const filtered = bottles.filter(b => {
    const matchesSearch = (b.nombre || "").toLowerCase().includes(search.toLowerCase()) || 
                         (b.marca || "").toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCategory === 'all' || b.categoria?.toLowerCase() === filterCategory.toLowerCase();
    
    const isBottle = b.tipo === 'botella';
    const currentStock = Number(b.stockMl || 0);
    const capacity = Number(b.mlPorUnidad || 1);
    const stockUnits = currentStock / capacity;
    const stockMin = Number(b.stockMinMl || 0);

    let matchesStock = true;
    if (filterStock === 'available') {
      matchesStock = isBottle ? stockUnits > 10 : true;
    } else if (filterStock === 'low_stock') {
      matchesStock = isBottle && currentStock <= stockMin;
    }
    return matchesSearch && matchesCat && matchesStock;
  })

  const groupedData = CATEGORIES.map(cat => ({
    ...cat,
    items: filtered.filter(b => b.categoria?.toLowerCase() === cat.value.toLowerCase())
  })).filter(g => g.items.length > 0)

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#0f172a]">
       <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
    </div>
  )

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col space-y-4 font-rounded text-white overflow-hidden px-2 md:px-4">
      
      {/* HEADER DINÁMICO */}
      <div className="flex flex-col gap-4 bg-slate-900/90 border border-slate-800 p-4 md:p-6 rounded-[2rem] shadow-2xl shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter uppercase text-white">INVENTARIO</h1>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}><LayoutGrid size={18}/></button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}><List size={18}/></button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-1 items-center gap-3 w-full max-w-4xl">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
              <input type="text" placeholder="BUSCAR..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-950 border-2 border-slate-800 rounded-2xl text-white outline-none font-bold text-sm" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="flex-1 sm:flex-none p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl cursor-pointer shadow-xl transition-all flex items-center justify-center">
                 {isImporting ? <Loader2 className="animate-spin" size={20} /> : <FileSpreadsheet size={20}/>}
                 <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleImportExcel} />
              </label>
              <button onClick={() => { setEditingBottle(null); setFormData(initialForm); setShowModal(true) }} className="flex-1 sm:flex-none p-3 bg-white text-slate-950 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center"><Plus size={20} strokeWidth={4}/></button>
            </div>
          </div>
        </div>

        {/* FILTROS DE STOCK Y CATEGORÍA */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full sm:w-48 bg-slate-950 border-2 border-slate-800 p-2 rounded-xl text-[10px] font-black uppercase text-indigo-400 outline-none">
            <option value="all">📁 TODAS</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label.toUpperCase()}</option>)}
          </select>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'all', label: 'Todos', color: 'indigo', icon: <Layers size={12}/> },
              { id: 'available', label: 'Stock > 10', color: 'emerald', icon: <CheckCircle2 size={12}/> },
              { id: 'low_stock', label: 'Bajos', color: 'amber', icon: <AlertCircle size={12}/> }
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setFilterStock(s.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all whitespace-nowrap ${
                  filterStock === s.id 
                  ? `bg-${s.color}-600/20 border-${s.color}-500 text-${s.color}-400` 
                  : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                {s.icon}
                <span className="text-[9px] font-black uppercase tracking-widest">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LISTADO RESPONSIVE */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-8 custom-scrollbar pb-24">
        {groupedData.map((group) => (
          <div key={group.value} className="space-y-4">
            <h2 className="text-sm md:text-lg font-black text-indigo-400 uppercase italic px-2 flex items-center gap-3">
              <span>{group.icon}</span> {group.label}
              <div className="flex-1 h-[1px] bg-slate-800/50" />
            </h2>
            <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6" : "flex flex-col gap-3"}>
              {group.items.map((b) => {
                const isBottle = b.tipo === 'botella';
                const units = isBottle ? (Number(b.stockMl || 0) / Number(b.mlPorUnidad || 1)).toFixed(1) : 0;
                const isEmpty = isBottle && Number(b.stockMl || 0) <= 1.5;
                const low = isBottle && !isEmpty && Number(b.stockMl) <= Number(b.stockMinMl);

                if (viewMode === 'list') {
                  return (
                    <div key={b.id} className="relative bg-[#0f172a]/40 border-2 border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className={`text-sm font-black uppercase italic truncate ${isEmpty ? 'text-slate-500' : 'text-white'}`}>{b.nombre}</h3>
                        <span className={`text-[12px] font-black uppercase ${isEmpty ? 'text-rose-500' : low ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {isEmpty ? 'Agotado' : low ? 'Bajo Stock' : isBottle ? 'En Stock' : 'Receta'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs font-black italic text-emerald-500">${b.precio}</p>
                          <p className="text-[20px] font-black text-slate-300">{isBottle ? `${units} u.` : '—'}</p>
                        </div>
                        <button onClick={() => { setEditingBottle(b); setFormData(b); setShowModal(true) }} className="p-2 bg-slate-800 rounded-lg text-slate-300"><Edit2 size={14} /></button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={b.id} className={`bg-[#111827]/80 border-2 ${isEmpty ? 'border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'border-slate-800'} rounded-[2rem] p-5 flex flex-col justify-between transition-all group relative`}>
                    <div className="flex justify-between items-start">
                      <span className={`px-2 py-1 rounded-lg text-[12px] font-black uppercase ${isEmpty ? 'bg-rose-600' : low ? 'bg-amber-600' : !isBottle ? 'bg-purple-600' : 'bg-emerald-600'} text-white shadow-lg`}>
                        {isEmpty ? 'AGOTADO' : low ? 'BAJO' : b.tipo?.toUpperCase()}
                      </span>
                      <button onClick={() => { setEditingBottle(b); setFormData(b); setShowModal(true) }} className="p-2 bg-slate-800 rounded-xl text-white md:opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={14} /></button>
                    </div>
                    <h3 className={`font-black uppercase italic text-lg leading-tight my-3 truncate ${isEmpty ? 'text-slate-500' : 'text-white'}`}>{b.nombre}</h3>
                    <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/50 flex justify-between items-center">
                        <div><p className="text-[12px] text-slate-500 uppercase">Venta</p><p className={`text-xl font-black italic leading-none ${isEmpty ? 'text-slate-600' : 'text-emerald-400'}`}>${b.precio}</p></div>
                        <div className="text-right"><p className="text-[12px] text-slate-500 uppercase">Stock</p><p className={`text-base font-black italic leading-none ${isEmpty ? 'text-rose-500' : low ? 'text-orange-500' : 'text-white'}`}>{isBottle ? `${units} u.` : 'RECETA'}</p></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL FICHA PRODUCTO */}
      {showModal && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/95 backdrop-blur-sm">
          <div className="bg-[#0f172a] border-t-2 sm:border-2 border-slate-800 rounded-t-[2.5rem] sm:rounded-[3rem] w-full sm:max-w-4xl shadow-2xl flex flex-col overflow-hidden h-[95vh] sm:h-auto sm:max-h-[90vh] animate-in slide-in-from-bottom duration-300">
            
            <div className="p-6 border-b-2 border-slate-800 flex justify-between items-center bg-indigo-600/5">
              <h2 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tighter">Ficha de Producto</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 uppercase ml-2">Tipo</label>
                    <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-800 rounded-2xl text-white font-black text-sm outline-none focus:border-indigo-500">
                      <option value="botella">📦 BOTELLA (Insumo)</option>
                      <option value="trago">🍹 TRAGO (Mezcla/ML)</option>
                      <option value="combo">🎁 COMBO (Unidades)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Nombre</label>
                    <input type="text" placeholder="NOMBRE" required value={formData.nombre || ''} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-800 rounded-2xl text-white font-black uppercase italic text-base outline-none focus:border-indigo-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Categoría</label>
                        <select value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value as any})} className="w-full px-2 py-3 bg-slate-950 border-2 border-slate-800 rounded-2xl text-slate-300 font-bold text-xs outline-none focus:border-indigo-500">{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Marca</label>
                        <input type="text" placeholder="MARCA" value={formData.marca || ''} onChange={e => setFormData({...formData, marca: e.target.value})} className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-800 rounded-2xl text-white font-black uppercase italic text-xs outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {formData.tipo === 'botella' ? (
                    <div className="bg-slate-950 p-6 rounded-[2rem] border-2 border-slate-800 space-y-4">
                      <div className="text-center">
                        <label className="text-[11px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Capacidad Botella (ML)</label>
                        <input type="number" placeholder="750" value={formData.mlPorUnidad ?? ''} onChange={e => setFormData({...formData, mlPorUnidad: e.target.value})} className="w-full bg-transparent text-center text-5xl font-black text-white outline-none italic" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
                        <div className="text-center">
                          <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Unidades Actuales</p>
                          <input 
                            type="text"
                            inputMode="decimal"
                            value={unitsText}
                            className="w-full bg-slate-900 border border-slate-800 p-2 rounded-xl text-xl font-black text-white text-center outline-none focus:border-indigo-500"
                            onChange={(e) => {
                              const val = e.target.value.replace(',', '.');
                              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                setUnitsText(val);
                                const num = parseFloat(val) || 0;
                                const ml = Number(formData.mlPorUnidad || 750);
                                setFormData({ ...formData, stockMl: num * ml });
                              }
                            }}
                            onBlur={() => {
                              const final = parseFloat(unitsText) || 0;
                              setUnitsText(final.toFixed(1));
                            }}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-black text-amber-500 uppercase mb-2">Aviso Mínimo</p>
                          <input 
                            type="text"
                            inputMode="decimal"
                            value={minUnitsText}
                            className="w-full bg-amber-600/10 border border-amber-500/30 p-2 rounded-xl text-xl font-black text-amber-400 text-center outline-none focus:border-amber-500"
                            onChange={(e) => {
                              const val = e.target.value.replace(',', '.');
                              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                setMinUnitsText(val);
                                const num = parseFloat(val) || 0;
                                const ml = Number(formData.mlPorUnidad || 750);
                                setFormData({ ...formData, stockMinMl: num * ml });
                              }
                            }}
                            onBlur={() => {
                              const final = parseFloat(minUnitsText) || 0;
                              setMinUnitsText(final.toFixed(1));
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-center pt-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase">Volumen Real: </span>
                        <span className="text-[10px] font-black text-indigo-400">{formData.stockMl || 0} ML</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-950 p-6 rounded-[2rem] border-2 border-slate-800 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <h4 className="text-sm font-black text-purple-400 uppercase flex items-center gap-2"><Beaker size={18}/> Receta</h4>
                        {formData.tipo === 'trago' && (
                          <div className="text-right">
                            <span className="text-[10px] font-black text-emerald-400 uppercase">{calcularGraduacionFinal()}% Alcohol</span>
                          </div>
                        )}
                      </div>
                      <div className="max-h-40 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                        {(formData.receta || []).map((r:any, idx:number) => (
                          <div key={idx} className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl">
                             <p className="flex-1 text-[10px] font-black text-white uppercase truncate">{bottles.find(b => b.id === r.productId)?.nombre}</p>
                             <input type="number" value={r.cantidad ?? ''} onChange={e => {const n=[...formData.receta]; n[idx].cantidad=e.target.value; setFormData({...formData, receta:n})}} className="w-12 bg-slate-950 rounded p-1 text-xs font-black text-indigo-400 text-center outline-none" />
                             <button type="button" onClick={() => setFormData({...formData, receta: formData.receta.filter((_:any, i:number)=>i!==idx)})} className="text-rose-500 p-1"><X size={16}/></button>
                          </div>
                        ))}
                      </div>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500" />
                        <input type="text" placeholder="AGREGAR..." value={searchInsumo} onChange={(e) => { setSearchInsumo(e.target.value); setShowDropdown(true); }} className="w-full pl-9 pr-4 py-2 bg-indigo-600/5 border-2 border-dashed border-indigo-500/20 rounded-xl text-xs font-black text-indigo-400 outline-none" />
                        {showDropdown && searchInsumo.length > 0 && (
                          <div className="absolute z-[100] w-full mt-2 bg-slate-900 border-2 border-slate-800 rounded-xl max-h-40 overflow-y-auto shadow-2xl">
                            {bottles.filter(b => b.tipo === 'botella' && b.nombre.toLowerCase().includes(searchInsumo.toLowerCase())).map(b => (
                                <button key={b.id} type="button" onClick={() => { setFormData({...formData, receta: [...(formData.receta || []), { productId: b.id, cantidad: '' }]}); setShowDropdown(false); setSearchInsumo(''); }} className="w-full text-left p-3 hover:bg-indigo-600/10 text-[10px] font-black uppercase text-white border-b border-slate-800 last:border-0">{b.nombre}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950 rounded-[2rem] border-2 border-slate-800 shadow-2xl">
                  <div className="text-center border-r border-slate-800">
                    <label className="text-[9px] font-black text-rose-500 uppercase block mb-1 tracking-tighter">Costo</label>
                    <div className="flex items-center justify-center gap-1">
                        <span className="text-lg font-black text-rose-500/50">$</span>
                        <input type="number" value={formData.tipo !== 'botella' ? calcularCostoReceta().toFixed(0) : (formData.precioCosto || '')} onChange={e => setFormData({...formData, precioCosto: Number(e.target.value)})} disabled={formData.tipo !== 'botella'} className="bg-transparent text-2xl font-black text-white text-center w-full outline-none italic" />
                    </div>
                  </div>
                  <div className="text-center">
                    <label className="text-[9px] font-black text-emerald-500 uppercase block mb-1 tracking-tighter">Venta</label>
                    <div className="flex items-center justify-center gap-1">
                        <span className="text-lg font-black text-emerald-500/50">$</span>
                        <input type="number" value={formData.precio || ''} onChange={e => setFormData({...formData, precio: Number(e.target.value)})} className="bg-transparent text-2xl font-black text-white text-center w-full outline-none italic" />
                    </div>
                  </div>
              </div>

              <div className="flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-5 bg-slate-800 text-slate-400 font-black text-lg rounded-[1rem] shadow-xl hover:bg-slate-700 transition-all uppercase italic active:scale-95"
                >
                  CERRAR
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] py-5 bg-indigo-600 text-white font-black text-xl rounded-[2rem] shadow-xl hover:bg-indigo-500 transition-all uppercase italic flex items-center justify-center gap-3 active:scale-95"
                >
                  <Save size={24}/> GUARDAR 
                </button>
              </div>
              
            </form>
          </div>
        </div>
      )}
    </div>
  )
}