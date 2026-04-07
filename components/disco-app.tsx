'use client'

import { useAuth, AuthProvider } from '@/lib/auth-context'
import { InventoryProvider } from '@/lib/inventory-context' 
import { LoginForm } from './login-form'
import { MainDashboard } from './main-dashboard'

function AppContent() {
  const { user, isLoading } = useAuth()

  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

 
  if (!user) {
    return <LoginForm />
  }

  return (
    <InventoryProvider>
      <MainDashboard />
    </InventoryProvider>
  )
}

export function DiscoApp() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}