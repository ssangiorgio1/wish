'use client'

import { useEffect, useState } from 'react'
import { getDashboardStats, getBottles, getAlerts, getMovements } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { Botella, Alerta } from '@/lib/types'
import { 
  Package, 
  DollarSign, 
  AlertTriangle, 
  XCircle, 
  TrendingUp, 
  Wine,
  Zap,
  Truck,
  Activity,
  Loader2,
  Droplets
} from 'lucide-react'

interface DashboardViewProps {
  onNavigate: (section: string) => void
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { user } = useAuth()
  const [stats, setStats] = useState<any | null>(null)
  const [lowStockItems, setLowStockItems] = useState<Botella[]>([])
  const [recentAlerts, setRecentAlerts] = useState<Alerta[]>([])
  const [ownerMetrics, setOwnerMetrics] = useState({ revenue: 0, efficiency: 0 })
  const [loading, setLoading] = useState(true)

  const isOwner = user?.role === 'owner'

  const loadData = async () => {
    try {
      const [currentStats, bottles, alerts] = await Promise.all([
        getDashboardStats(),
        getBottles(),
        getAlerts()
      ])
      
      setStats(currentStats)
      
      // 1. Filtrar items con poco stock (Usamos la misma lógica del store para ser consistentes)
      const lowStock = bottles
        .filter((b: Botella) => b.tipo === 'botella' && Number(b.stockMl) <= Number(b.stockMinMl))
        .slice(0, 5)
      setLowStockItems(lowStock)

      //POCO STOCK: Si queremos ser más estrictos, podríamos ordenar por el porcentaje de stock restante para mostrar primero los más críticos. Ejemplo:
          const out_of_stock = bottles
          .filter((b: Botella) => b.tipo === 'botella' && Number(b.stockMl) <= Number(b.stockMinMl))
            .sort((a, b) => (Number(a.stockMl) / Number(a.stockMinMl)) - (Number(b.stockMl) / Number(b.stockMinMl)))
            .slice(0, 5)
          setLowStockItems(lowStock)
      
      // 2. Alertas pendientes
      setRecentAlerts((alerts as Alerta[]).filter(a => !a.leida).slice(0, 5))

      // 3. Métricas de Dueño (Hoy)
      if (isOwner) {
        // Usamos el revenueToday que ya calculó getDashboardStats para no repetir trabajo
        const totalSoldToday = currentStats.revenueToday || 0
        const totalStockValue = currentStats.valorTotal || 0
        
        // Eficiencia basada en valor de stock vs venta
        const efficiency = (totalSoldToday / (totalSoldToday + totalStockValue)) * 100
        
        setOwnerMetrics({ 
          revenue: totalSoldToday, 
          efficiency: isNaN(efficiency) ? 0 : efficiency 
        })
      }
    } catch (error) {
      console.error("Error cargando Dashboard:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) 
    return () => clearInterval(interval)
  }, [isOwner])

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse italic">Sincronizando Pulso de Barra...</p>
      </div>
    )
  }

  // Si no hay stats pero terminó de cargar, algo falló en Firebase
  if (!stats) return null

  return (
    <div className="space-y-10 animate-in fade-in duration-700 font-rounded pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter italic uppercase flex items-center gap-3">
            <Activity className="text-indigo-500 w-8 h-8" />
            Tablero
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">
            {isOwner ? 'Panel de Control Gerencial' : `Monitor de Turno: ${user?.name}`}
          </p>
        </div>
        
        
      </div>

      {/* MÉTRICAS DUEÑO (CAJA Y EFICIENCIA) */}
      {isOwner && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-1000 px-2">
          <div className="bg-indigo-600 p-8 rounded-[3rem] shadow-2xl shadow-indigo-600/20 relative overflow-hidden group">
            <DollarSign className="absolute -right-4 -bottom-4 w-40 h-40 text-white opacity-10 group-hover:scale-110 transition-transform duration-700" />
            <p className="text-indigo-100 font-black uppercase text-[10px] tracking-widest mb-1">Recaudación Bruta (Hoy)</p>
            <h2 className="text-6xl font-black text-white italic tracking-tighter">
              ${ownerMetrics.revenue.toLocaleString()}
            </h2>
          </div>

          <div className="bg-slate-900 border-2 border-slate-800 p-8 rounded-[3rem] relative overflow-hidden group">
            <TrendingUp className="absolute -right-4 -bottom-4 w-40 h-40 text-emerald-500 opacity-5 group-hover:rotate-12 transition-transform duration-700" />
            <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest mb-1">Rotación de Stock</p>
            <h2 className="text-6xl font-black text-white italic tracking-tighter">
              {ownerMetrics.efficiency.toFixed(1)}%
            </h2>
          </div>
        </div>
      )}

      {/* STATS GRID (VOLUMEN REAL) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
        {[
          { label: 'Stock en Barra', val: `${stats.totalBotellas || 0} bot.`, icon: Droplets, color: 'text-indigo-400' },
          { label: 'Valor en Bodega', val: `$${(stats.valorTotal || 0).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400' },
          { label: 'Stock Crítico', val: stats.conteoStockBajo || 0, icon: AlertTriangle, color: 'text-orange-400' },
          { label: 'Agotados', val: stats.conteoSinStock || 0, icon: XCircle, color: 'text-red-400' },
          
        ].map((s, i) => (
          <div key={i} className="bg-[#0f172a]/40 border-2 border-slate-800 p-6 rounded-[2.2rem] hover:border-indigo-500/30 transition-all group relative overflow-hidden">
            <s.icon className={`absolute -right-3 -bottom-3 w-20 h-20 opacity-5 ${s.color}`} />
            <s.icon className={`w-5 h-5 ${s.color} mb-4`} />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{s.label}</p>
            <p className="text-3xl font-black text-white mt-1 tracking-tighter italic">{s.val}</p>
          </div>
        ))}
      </div>

      {/* LISTAS INFERIORES */}
      <div className="grid lg:grid-cols-2 gap-8 px-2">
        {/* REPOSICIÓN */}
        <div className="bg-slate-900/20 border-2 border-slate-800 rounded-[3rem] p-8">
          <div className="flex items-center justify-between mb-8">
             <h3 className="font-black text-white uppercase italic text-lg tracking-tight">Reposición Urgente</h3>
             <Wine className="text-orange-500 w-5 h-5 opacity-50" />
          </div>
          <div className="space-y-3">
            {lowStockItems.length === 0 ? (
              <p className="text-slate-700 font-black uppercase italic text-xs py-10 text-center">Todo en orden en la barra</p>
            ) : lowStockItems.map(item => {
              const stockRestante = (Number(item.stockMl || 0) / Number(item.mlPorUnidad || 750)).toFixed(1);
              return (
                <div key={item.id} className="flex items-center justify-between bg-slate-900/50 p-5 rounded-2xl border border-slate-800 hover:border-orange-500/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-orange-500">
                       <Wine className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-white text-sm uppercase italic leading-none">{item.nombre}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{item.marca}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-orange-500 text-xl leading-none italic">{stockRestante}</p>
                    <p className="text-[9px] font-black text-slate-600 uppercase italic">Bot. Restantes</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* NOTIFICACIONES */}
        <div className="bg-slate-900/20 border-2 border-slate-800 rounded-[3rem] p-8">
          <div className="flex items-center justify-between mb-8">
             <h3 className="font-black text-white uppercase italic text-lg tracking-tight">Centro de Alertas</h3>
             <Activity className="text-indigo-500 w-5 h-5 opacity-50" />
          </div>
          <div className="space-y-3">
            {recentAlerts.length === 0 ? (
              <p className="text-slate-700 font-black uppercase italic text-xs py-10 text-center">Sin novedades de stock</p>
            ) : recentAlerts.map(alert => (
              <div key={alert.id} className="flex items-center gap-4 bg-slate-950/50 p-5 rounded-2xl border border-slate-800 animate-in slide-in-from-right-4">
                <div className={`w-1.5 h-10 rounded-full ${alert.tipo === 'out_of_stock' ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-[11px] uppercase tracking-tight truncate italic">{alert.nombreBotella}</p>
                  <p className={`text-[9px] font-black uppercase mt-0.5 ${alert.tipo === 'out_of_stock' ? 'text-rose-500' : 'text-orange-500'}`}>
                    {alert.tipo === 'out_of_stock' ? 'Agotado: Reponer ya' : `Stock Crítico`}
                  </p>
                </div>
                <button onClick={() => onNavigate('alerts')} className="p-2 bg-slate-800 text-slate-500 rounded-lg hover:text-white transition-colors">
                   <Zap className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}