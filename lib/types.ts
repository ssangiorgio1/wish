// ✅ Roles de usuario
export type RolUsuario = 'owner' | 'employee'

// ✅ Usuario
export interface Usuario {
  id: string
  username: string
  role: RolUsuario
  name: string
}

// ✅ Receta: La "fórmula" para Tragos y Combos
export interface ItemReceta {
  productId: string         // ID de la BOTELLA base (insumo)
  cantidad: number          // ML para Tragos, Unidades para Combos
}

// ✅ Categorías permitidas
export type CategoriaProducto = 
  | 'whisky' | 'vodka' | 'ron/licor' | 'tequila' | 'gin' 
  | 'cerveza' | 'vino' | 'champagne' | 'Gaseosa' 
  | 'Trago' | 'Combo' | 'otros'

// ✅ Botellas y Productos (El modelo principal)
export interface Botella {
  id: string
  nombre: string
  marca: string
  categoria: CategoriaProducto
  tipo: 'botella' | 'trago' | 'combo'
  
  precio: number
  precioCosto: number
  
  // 🥃 Propiedades para BOTELLAS (Insumos Físicos)
  mlPorUnidad: number       // Capacidad de la botella (750, 1000, 1500)
  stockMl: number           // Stock real en mililitros acumulados
  stockMinMl: number        // Alerta mínima en mililitros
  graduacion?: number       // % Alcohol (opcional para botellas)

  // 🍹 Propiedades para TRAGOS / COMBOS
  receta?: ItemReceta[]     // Array de insumos vinculados
  isCombo?: boolean         // Flag visual
  capacidadVaso?: number    // ML del vaso para cálculos de dilución (solo tragos)

  createdAt: string
  updatedAt?: string
}

// ✅ Movimientos de Stock
export interface MovimientoStock {
  id: string
  botellaId: string         // ID del producto vendido o ingresado
  nombreBotella: string
  tipo: 'entrada' | 'venta' | 'ajuste'
  
  cantidad: number          // Cantidad de unidades (Botellas cerradas, Vasos o Combos)
  
  monto: number             // Precio total de la transacción
  costo: number             // Costo total para calcular ROI
  
  usuarioId: string
  nombreUsuario: string
  notas?: string
  createdAt: string
}

// ✅ Alertas inteligentes
export interface Alerta {
  id: string
  botellaId: string
  nombreBotella: string
  tipo: 'low_stock' | 'out_of_stock'
  leida: boolean
  createdAt: string
}

// ✅ Estadísticas de Dashboard
export interface EstadisticasDashboard {
  totalBotellas: number     // Calculado como stockMl / mlPorUnidad
  valorTotal: number        // Inversión total en bodega (stock * costo)
  conteoStockBajo: number
  conteoSinStock: number
  revenueToday: number      // Ventas totales del día
}