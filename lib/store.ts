import { db } from './firebase'; 
export { db }; 

import { 
  collection, addDoc, updateDoc, doc, getDocs, getDoc,
  deleteDoc, query, orderBy, limit, writeBatch, where, getCountFromServer
} from "firebase/firestore";
import type { Botella, ItemReceta, MovimientoStock, Alerta } from './types';

const COL_BOTELLAS = 'botellas';
const COL_MOVIMIENTOS = 'movements';
const COL_ALERTAS = 'alerts';
const COL_ARQUEOS = 'cash_audits';

// --- 1. OBTENER TODO EL INVENTARIO ---
export async function getBottles(): Promise<Botella[]> {
  try {
    const snap = await getDocs(collection(db, COL_BOTELLAS));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Botella));
  } catch (error) {
    console.error("Error al obtener inventario:", error);
    return [];
  }
}

// --- 2. REGISTRAR MOVIMIENTO (Con lógica de cierre isClosed) ---
export async function addMovement(
  productId: string,
  type: 'venta' | 'entrada' | 'ajuste',
  quantity: number, 
  userId: string,
  userName: string,
  notes: string = "",
  externalDate?: string,
  manualCost?: number,
  batchId?: string 
): Promise<any> {
  const batch = writeBatch(db);
  const normalizedType = type.toLowerCase();
  
  try {
    const botRef = doc(db, COL_BOTELLAS, productId);
    const botSnap = await getDoc(botRef);
    if (!botSnap.exists()) return null;
    const item = { id: botSnap.id, ...botSnap.data() } as Botella;

    const esRegalo = normalizedType === 'venta' && (
      notes.includes("CORTESIA") || 
      notes.includes("REGALO") || 
      notes.includes("INVITACION") ||
      notes.includes("Pago: REGALO")
    );
      
    const precioUnitario = Number(item.precio || 0);
    const timestamp = externalDate || new Date().toISOString();

    // --- LÓGICA DE STOCK ---
    if ((item.tipo === 'trago' || item.tipo === 'combo') && item.receta) {
      for (const ing of item.receta) {
        const insumoId = ing.productId || (ing as any).productID;
        const insumoRef = doc(db, COL_BOTELLAS, insumoId);
        const insumoSnap = await getDoc(insumoRef);
        if (!insumoSnap.exists()) continue;
        const dataInsumo = insumoSnap.data() as Botella;
        let desc = (item.tipo === 'trago') 
          ? Number(ing.cantidad) * quantity 
          : Number(ing.cantidad) * quantity * (Number(dataInsumo.mlPorUnidad) || 0);

        const nuevoStock = Math.max(0, (Number(dataInsumo.stockMl) || 0) - desc);
        batch.update(insumoRef, { stockMl: nuevoStock, updatedAt: timestamp });
        await checkAndCreateAlerts(insumoId, { ...dataInsumo, stockMl: nuevoStock });
      }
    } else {
      const mlPorU = Number(item.mlPorUnidad || 0);
      const ajuste = normalizedType === 'entrada' ? mlPorU * quantity : -mlPorU * quantity;
      const nuevoStock = Math.max(0, (Number(item.stockMl) || 0) + ajuste);
      batch.update(botRef, { stockMl: nuevoStock, updatedAt: timestamp });
      await checkAndCreateAlerts(productId, { ...item, stockMl: nuevoStock });
    }

    const movementRef = doc(collection(db, COL_MOVIMIENTOS));
    
    const movementData = {
      botellaId: productId,
      nombreBotella: item.nombre,
      tipo: normalizedType,
      cantidad: quantity,
      monto: esRegalo ? 0 : precioUnitario * quantity,
      valorCortesia: esRegalo ? precioUnitario * quantity : 0, 
      costo: normalizedType === 'entrada' 
        ? (manualCost !== undefined ? manualCost * quantity : (item.precioCosto || 0) * quantity)
        : (item.precioCosto || 0) * quantity, 
      usuarioId: userId,
      nombreUsuario: userName,
      notas: notes,
      batchId: batchId || null, 
      isClosed: false, // 🔥 Clave para el Arqueo: Indica que la venta no ha sido cerrada aún
      createdAt: timestamp,
      categoria: item.categoria || 'otros'
    };

    batch.set(movementRef, movementData);
    await batch.commit();
    return { id: movementRef.id, ...movementData };

  } catch (error) {
    console.error("Error en addMovement:", error);
    return null;
  }
}

// --- 3. FUNCIONES ABM ---
export async function addBottle(datos: Partial<Botella>) {
  const docRef = await addDoc(collection(db, COL_BOTELLAS), {
    ...datos,
    stockMl: Number(datos.stockMl || 0),
    stockMinMl: Number(datos.stockMinMl || 0),
    mlPorUnidad: Number(datos.mlPorUnidad || 0),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return { id: docRef.id, ...datos };
}

export async function updateBottle(id: string, updates: Partial<Botella>) {
  const botRef = doc(db, COL_BOTELLAS, id);
  await updateDoc(botRef, { ...updates, updatedAt: new Date().toISOString() });
  return true;
}

export async function deleteBottle(id: string) {
  await deleteDoc(doc(db, COL_BOTELLAS, id));
  return true;
}

// --- 4. ALERTAS ---
async function checkAndCreateAlerts(id: string, item: any) {
  const currentMl = Number(item.stockMl || 0);
  const minMl = Number(item.stockMinMl || 0);
  
  if (currentMl <= minMl) {
    const tipoAlerta = currentMl <= 1.5 ? "out_of_stock" : "low_stock";
    const q = query(
      collection(db, COL_ALERTAS), 
      where("botellaId", "==", id), 
      where("leida", "==", false),
      where("tipo", "==", tipoAlerta)
    );
    
    const snap = await getDocs(q);
    if (snap.empty) {
      await addDoc(collection(db, COL_ALERTAS), {
        botellaId: id,
        nombreBotella: item.nombre || 'Producto',
        leida: false,
        tipo: tipoAlerta,
        createdAt: new Date().toISOString()
      });
    }
  }
}

export async function getAlerts() {
  const q = query(collection(db, COL_ALERTAS), orderBy("createdAt", "desc"), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// --- 5. OBTENER MOVIMIENTOS (Actualizada para Arqueo) ---
export async function getMovements(start?: Date, end?: Date): Promise<MovimientoStock[]> {
  try {
    let q;
    const movementsRef = collection(db, COL_MOVIMIENTOS);
    
    if (start && end) {
      // Para Reportes Históricos (filtramos por fecha y traemos todo)
      q = query(
        movementsRef,
        where("createdAt", ">=", start.toISOString()),
        where("createdAt", "<=", end.toISOString()),
        orderBy("createdAt", "desc")
      );
    } else {
      // PARA EL ARQUEO: Solo traemos lo que NO está cerrado
      q = query(
        movementsRef, 
        where("isClosed", "==", false), 
        orderBy("createdAt", "desc")
      );
    }
    
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as MovimientoStock));
  } catch (error) {
    console.error("Error al obtener movimientos:", error);
    return [];
  }
}

// --- 6. ESTADÍSTICAS DASHBOARD (Filtrado por isClosed: false) ---
export async function getDashboardStats() {
  try {
    const items = await getBottles();
    const onlyBottles = items.filter(i => i.tipo === 'botella');

    // Solo ventas de la jornada activa (sin cerrar)
    const qActive = query(
      collection(db, COL_MOVIMIENTOS),
      where("isClosed", "==", false),
      where("tipo", "==", "venta")
    );
    
    const snapActive = await getDocs(qActive);
    
    let revenueToday = 0;
    let giftsTotalToday = 0;

    snapActive.docs.forEach(d => {
      const data = d.data();
      revenueToday += (Number(data.monto) || 0);
      giftsTotalToday += (Number(data.valorCortesia) || 0);
    });

    return {
      totalBotellas: Number(onlyBottles.reduce((sum, i) => sum + (Number(i.stockMl || 0) / Number(i.mlPorUnidad || 1)), 0).toFixed(1)),
      valorTotal: Number(onlyBottles.reduce((sum, i) => {
          const unidades = Number(i.stockMl || 0) / Number(i.mlPorUnidad || 1);
          return sum + (unidades * Number(i.precioCosto || 0));
        }, 0).toFixed(2)),
      conteoSinStock: onlyBottles.filter(i => Number(i.stockMl || 0) <= 1.5).length,
      conteoStockBajo: onlyBottles.filter(i => {
          const stock = Number(i.stockMl || 0);
          const min = Number(i.stockMinMl || 0);
          return stock <= min && stock > 1.5;
      }).length,
      revenueToday: Number(revenueToday),
      giftsToday: Number(giftsTotalToday) 
    };
  } catch (error) { return { totalBotellas: 0, valorTotal: 0, conteoStockBajo: 0, conteoSinStock: 0, revenueToday: 0, giftsToday: 0 }; }
}

// --- 7. ARQUEO Y CIERRE DE JORNADA ---

// ✅ Función para cerrar movimientos pendientes
export async function closeCurrentMovements(userName?: string) {
  try {
    const movementsRef = collection(db, COL_MOVIMIENTOS);

    let q;

    if (!userName || userName === 'todos') {
      // 🔥 CIERRE GLOBAL (admin)
      q = query(
        movementsRef,
        where("isClosed", "==", false)
      );
    } else {
      // 🔒 CIERRE INDIVIDUAL
      q = query(
        movementsRef,
        where("isClosed", "==", false),
        where("nombreUsuario", "==", userName)
      );
    }

    const snap = await getDocs(q);
    if (snap.empty) return true;

    const batch = writeBatch(db);

    snap.docs.forEach(d => {
      batch.update(d.ref, {
        isClosed: true,
        closedAt: new Date().toISOString(),
        closedBy: userName || 'GLOBAL'
      });
    });

    await batch.commit();
    return true;

  } catch (e) {
    console.error("Error cerrando movimientos:", e);
    return false;
  }
}

// ✅ Guardar arqueo y gatillar el cierre
export async function saveCashAudit(auditData: any) {
  try {
    const auditRef = collection(db, COL_ARQUEOS);
    
    const totalSist = Number(auditData.esperado.Efectivo || 0) + 
                     Number(auditData.esperado.Transferencia || 0) + 
                     Number(auditData.esperado.Tarjeta || 0);
    
    const totalFis = Number(auditData.real.Efectivo || 0) + 
                    Number(auditData.real.Transferencia || 0) + 
                    Number(auditData.real.Tarjeta || 0);

    const docRef = await addDoc(auditRef, {
      ...auditData,
      totalSistema: totalSist,
      totalFisico: totalFis,
      diferencia: totalFis - totalSist,
      createdAt: new Date().toISOString()
    });

    // Marcamos los movimientos como cerrados para que la caja vuelva a $0
    await closeCurrentMovements(auditData.terminal);
    
    return { id: docRef.id };
  } catch (error) { 
    console.error("Error en saveCashAudit:", error);
    return null; 
  }
}

// --- 8. REPORTES Y OTROS ---
export async function getReportDataCloud(start: Date, end: Date) {
  try {
    const movimientos = await getMovements(start, end);
    let totalRevenue = 0;
    let totalGifts = 0;
    let totalCostOfSales = 0;
    const salesByBottleMap: Record<string, any> = {};

    movimientos.forEach((m: any) => {
      if (m.tipo === 'venta') {
        totalRevenue += Number(m.monto || 0);
        totalGifts += Number(m.valorCortesia || 0); 
        totalCostOfSales += Number(m.costo || 0);
        
        const bID = m.botellaId;
        if (!salesByBottleMap[bID]) {
          salesByBottleMap[bID] = { name: m.nombreBotella, quantity: 0, revenue: 0, gifts: 0 };
        }
        salesByBottleMap[bID].quantity += Number(m.cantidad || 0);
        salesByBottleMap[bID].revenue += Number(m.monto || 0);
        salesByBottleMap[bID].gifts += Number(m.valorCortesia || 0);
      }
    });

    return { 
      movements: movimientos, 
      totalRevenue, 
      totalGifts, 
      totalCost: totalCostOfSales, 
      profit: totalRevenue - totalCostOfSales, 
      salesByBottle: Object.values(salesByBottleMap).sort((a, b) => b.revenue - a.revenue) 
    };
  } catch (error) { return null; }
}

export async function markAlertAsRead(alertId: string): Promise<boolean> {
  try {
    const alertRef = doc(db, COL_ALERTAS, alertId);
    await updateDoc(alertRef, { leida: true, updatedAt: new Date().toISOString() });
    return true;
  } catch (error) { return false; }
}

export function savePendingMovement(movement: any) {
  try {
    const pending = JSON.parse(localStorage.getItem('pending_movements') || '[]');
    pending.push({ ...movement, syncStatus: 'pending', offlineAt: new Date().toISOString() });
    localStorage.setItem('pending_movements', JSON.stringify(pending));
  } catch (error) {}
}

export async function syncPendingMovements(): Promise<boolean> {
  const pending = JSON.parse(localStorage.getItem('pending_movements') || '[]');
  if (pending.length === 0) return true;
  const batch = writeBatch(db);
  try {
    pending.forEach((m: any) => {
      const ref = doc(collection(db, COL_MOVIMIENTOS));
      const { syncStatus, offlineAt, ...cleanMovement } = m;
      batch.set(ref, cleanMovement);
    });
    await batch.commit();
    localStorage.removeItem('pending_movements');
    return true;
  } catch (e) { return false; }
}

export function getPendingCount(): number {
  const pending = JSON.parse(localStorage.getItem('pending_movements') || '[]');
  return pending.length;
}