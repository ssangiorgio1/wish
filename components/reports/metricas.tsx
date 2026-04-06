'use client'

import React, { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePie, Pie, Cell, Legend, BarChart, Bar
} from 'recharts'
import { 
  Wallet, TrendingUp, ReceiptText, ShoppingCart, Info, 
  Percent, Gift, ArrowUpRight, Clock, Calendar
} from 'lucide-react'

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#10b981', '#f59e0b', '#06b6d4']

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(val);

const formatShort = (val: number) => 
  new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
  }).format(val);

export function Metricas({ reportData }: { reportData: any }) {
  // Filtros de hora (default: toda la noche)
  const [horaInicio, setHoraInicio] = useState(18); // 18:00 hs
  const [horaFin, setHoraFin] = useState(9);    // 09:00 hs (del día siguiente)

  const processed = useMemo(() => {
    if (!reportData || !reportData.movements) return null;

    // Lógica de filtrado por hora (considerando cruce de medianoche)
    const isInTimeRange = (dateString: string) => {
      const hour = new Date(dateString).getHours();
      if (horaInicio < horaFin) {
        return hour >= horaInicio && hour <= horaFin;
      } else {
        // Rango nocturno (ej: de 21 a 06)
        return hour >= horaInicio || hour <= horaFin;
      }
    };

    const sales = reportData.movements.filter((m: any) => m.tipo === 'venta' && isInTimeRange(m.createdAt));
    
    const totalVentas = sales.reduce((a: number, c: any) => a + Number(c.monto || 0), 0);
    const totalCostoVendido = sales.reduce((a: number, c: any) => a + Number(c.costo || 0), 0);
    const gananciaReal = totalVentas - totalCostoVendido;
    const porcentajeMargen = totalVentas > 0 ? (gananciaReal / totalVentas) * 100 : 0;

    const valorRegalado = sales
      .filter((m: any) => (m.notas?.toLowerCase().includes('regalo') || m.notas?.toLowerCase().includes('cortesía')))
      .reduce((a: number, c: any) => a + Number(c.monto || c.valorCortesia || 0), 0);

    // Gráfico de Rendimiento (Fecha + Hora)
    const hourlyMap: Record<string, { fullLabel: string, venta: number, ganancia: number, timestamp: number }> = {};
    sales.forEach((m: any) => {
      const d = new Date(m.createdAt);
      const fullLabel = `${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${d.getHours()}:00`;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
      
      if (!hourlyMap[key]) {
        hourlyMap[key] = { fullLabel, venta: 0, ganancia: 0, timestamp: d.getTime() };
      }
      const monto = Number(m.monto || 0);
      hourlyMap[key].venta += monto;
      hourlyMap[key].ganancia += (monto - Number(m.costo || 0));
    });
    const performanceData = Object.values(hourlyMap).sort((a, b) => a.timestamp - b.timestamp);

    // Gráfico de Crecimiento Acumulado
    let acc = 0;
    const trend = [...sales]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((m: any) => {
        acc += Number(m.monto || 0);
        return {
          time: new Date(m.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          acumulado: acc
        }
      });

    // Mix de Categorías
    const catMap: Record<string, number> = {};
    sales.forEach((m: any) => {
      const cat = m.categoria || 'Otros';
      catMap[cat] = (catMap[cat] || 0) + Number(m.monto || 0);
    });
    const pieData = Object.entries(catMap).map(([name, value]) => ({ name: name.toUpperCase(), value }));

    const topProducts = reportData.salesByBottle
      ?.filter((p: any) => sales.some((s: any) => s.botellaId === p.id))
      .slice(0, 5) || [];

    return { 
      trend, pieData, performanceData, totalVentas, gananciaReal, 
      totalCostoVendido, porcentajeMargen, valorRegalado, 
      salesCount: sales.length, topProducts 
    };
  }, [reportData, horaInicio, horaFin]);

  if (!processed) return null;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* 🛠️ FILTRO DE RANGO HORARIO */}
      <div className="bg-slate-900/80 border-2 border-indigo-500/20 p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400">
            <Clock size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Filtro de Jornada</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase">Ajustá el rango para analizar franjas horarias</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-950 p-2 rounded-2xl border border-slate-800">
          <div className="flex flex-col px-4">
            <label className="text-[8px] font-black text-slate-500 uppercase mb-1">Desde las</label>
            <select value={horaInicio} onChange={(e) => setHoraInicio(Number(e.target.value))} className="bg-transparent text-white font-black outline-none cursor-pointer">
              {Array.from({length: 24}).map((_, i) => <option key={i} value={i} className="bg-slate-900">{i}:00 hs</option>)}
            </select>
          </div>
          <div className="h-8 w-[1px] bg-slate-800" />
          <div className="flex flex-col px-4">
            <label className="text-[8px] font-black text-slate-500 uppercase mb-1">Hasta las</label>
            <select value={horaFin} onChange={(e) => setHoraFin(Number(e.target.value))} className="bg-transparent text-white font-black outline-none cursor-pointer">
              {Array.from({length: 24}).map((_, i) => <option key={i} value={i} className="bg-slate-900">{i}:00 hs</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* TARJETAS DE ESTADO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ganancia Real" value={formatCurrency(processed.gananciaReal)} icon={ArrowUpRight} color="text-emerald-400" sub="Utilidad Neta Libre" />
        <StatCard label="Venta Total" value={formatCurrency(processed.totalVentas)} icon={Wallet} color="text-indigo-400" sub="Facturación en Caja" />
        <StatCard label="Costo Mercadería" value={formatCurrency(processed.totalCostoVendido)} icon={ShoppingCart} color="text-rose-400" sub="Inversión en Stock" />
        <StatCard label="Rentabilidad" value={`${processed.porcentajeMargen.toFixed(2)}%`} icon={Percent} color="text-amber-400" sub="Margen sobre venta" />
      </div>

      {/* GRÁFICO BARRA COMPARATIVA (VENTA VS GANANCIA) */}
      <div className="grid grid-cols-1 gap-6">
        <ChartCard title="Rendimiento Temporal" sub="Comparativa de flujo horario">
            <div className="h-[450px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={processed.performanceData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis 
                          dataKey="fullLabel" 
                          stroke="#94a3b8" 
                          fontSize={12} // 👈 Más grande
                          fontWeight="bold"
                          tickLine={false} 
                          axisLine={false} 
                          angle={-45}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis 
                          stroke="#64748b" 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                          tickFormatter={(val) => `$${formatShort(val)}`} 
                        />
                        <Tooltip 
                            cursor={{fill: 'rgba(255,255,255,0.05)'}}
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', fontSize: '14px' }}
                            formatter={(value: number) => [formatCurrency(value), ""]}
                        />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '30px', fontSize: '14px', fontWeight: '900' }} />
                        <Bar name="Venta" dataKey="venta" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
                        <Bar name="Ganancia" dataKey="ganancia" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard title="Curva de Ingresos" sub="Crecimiento de caja">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={processed.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} fontWeight="bold" />
                  <YAxis stroke="#64748b" fontSize={10} tickFormatter={(val) => `$${formatShort(val)}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '14px' }} 
                    itemStyle={{ color: '#6366f1', fontWeight: 'bold' }}
                    formatter={(value: number) => [formatCurrency(value), "Acumulado"]}
                  />
                  <Area type="monotone" dataKey="acumulado" stroke="#6366f1" fillOpacity={0.1} fill="#6366f1" strokeWidth={5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <ChartCard title="Top Salidas" sub="Productos estrella">
          <div className="space-y-4">
            {processed.topProducts.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-slate-950/50 p-5 rounded-[1.5rem] border border-slate-800 transition-all hover:border-indigo-500/30">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black text-slate-700">0{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white uppercase italic truncate w-32 leading-none">{item.name}</p>
                    <p className="text-[9px] text-slate-600 font-bold uppercase mt-1">Más vendidos</p>
                  </div>
                </div>
                <p className="text-base font-black text-indigo-400 italic">{item.count} u.</p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Mix Financiero" sub="Distribución por Categoría">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RePie>
                <Pie data={processed.pieData} innerRadius={70} outerRadius={95} paddingAngle={8} dataKey="value">
                  {processed.pieData.map((_, i: number) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: 'none', borderRadius: '12px' }} formatter={(val: number) => formatCurrency(val)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px' }} />
              </RePie>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <div className="grid grid-rows-2 gap-6">
          <StatCard label="Ticket Promedio" value={formatCurrency(processed.totalVentas / (processed.salesCount || 1))} icon={ReceiptText} color="text-sky-400" sub="Promedio por venta" />
          <StatCard label="Cortesías" value={formatCurrency(processed.valorRegalado)} icon={Gift} color="text-purple-400" sub="Valor total de regalos" />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, sub }: any) {
  return (
    <div className="bg-[#0f172a]/60 border-2 border-slate-800/50 p-7 rounded-[2.5rem] relative overflow-hidden group shadow-2xl transition-all hover:border-slate-700">
      <Icon className={`absolute -right-4 -bottom-4 w-20 h-20 opacity-5 ${color} group-hover:scale-110 transition-all duration-500`} />
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">{label}</p>
      <h2 className={`text-2xl sm:text-3xl font-black italic tracking-tighter ${color}`}>{value}</h2>
      <div className="flex items-center gap-1.5 mt-2">
        <p className="text-[9px] text-slate-600 font-bold uppercase italic">{sub}</p>
      </div>
    </div>
  )
}

function ChartCard({ title, sub, children }: any) {
  return (
    <div className="bg-[#0f172a]/40 border-2 border-slate-800/50 p-8 rounded-[2.8rem] shadow-2xl backdrop-blur-sm">
      <div className="mb-6">
        <h2 className="text-white font-black uppercase italic text-lg tracking-tight leading-none">{title}</h2>
        <p className="text-[10px] text-slate-600 font-bold uppercase mt-2 italic tracking-widest">{sub}</p>
      </div>
      {children}
    </div>
  )
}