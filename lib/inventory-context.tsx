'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { db } from '@/lib/firebase' 
import { collection, onSnapshot } from 'firebase/firestore'
import { Botella } from './types'

interface InventoryContextType {
  bottles: Botella[]
  loading: boolean
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined)

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [bottles, setBottles] = useState<Botella[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    const unsubscribe = onSnapshot(collection(db, "botellas"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Botella[]
      setBottles(data)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return (
    <InventoryContext.Provider value={{ bottles, loading }}>
      {children}
    </InventoryContext.Provider>
  )
}

export const useInventory = () => {
  const context = useContext(InventoryContext)
  if (!context) throw new Error('useInventory debe usarse dentro de InventoryProvider')
  return context
}