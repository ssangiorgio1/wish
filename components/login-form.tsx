'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Martini, Eye, EyeOff, AlertCircle, Lock, Mail, Loader2, Zap, ArrowUpRight } from 'lucide-react'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!email || !password) {
      setError('Por favor completa todos los campos')
      return
    }

    setLoading(true)
    try {
      await login(email, password)
    } catch (err: any) {
      console.error(err)
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Credenciales incorrectas. Revisa tu email y contraseña.')
      } else if (err.code === 'auth/invalid-email') {
        setError('El formato del correo electrónico no es válido.')
      } else {
        setError('Ocurrió un error al intentar iniciar sesión.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4 font-rounded selection:bg-indigo-500/30">
      {/* BACKGROUND EFFECTS (Coincide con MainDashboard) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-rose-500/5 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-transparent" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="bg-slate-900/40 backdrop-blur-2xl border-2 border-slate-800 rounded-[3rem] shadow-2xl p-10 overflow-hidden">
          
          {/* Header */}
          <div className="flex flex-col items-center mb-12">
            <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-xl shadow-indigo-600/20 transform -rotate-3 transition-transform hover:rotate-0 duration-500">
              <Zap className="w-8 h-8 text-white fill-current" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">
              WI<span className="text-indigo-500 not-italic">SH</span>
            </h1>
            <div className="flex items-center gap-2 mt-3">
              <div className="h-[1px] w-4 bg-slate-700" />
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em]">Control de Barra</p>
              <div className="h-[1px] w-4 bg-slate-700" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-3 p-4 bg-rose-500/10 border-2 border-rose-500/20 rounded-2xl text-rose-400 text-[11px] font-black uppercase italic animate-in zoom-in-95">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-4 tracking-[0.2em]">Correo </label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full pl-14 pr-6 py-5 bg-slate-950/50 border-2 border-slate-800 rounded-[1.5rem] text-white placeholder:text-slate-700 focus:outline-none focus:border-indigo-500/50 transition-all font-bold"
                  placeholder="usuario@dominio.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-4 tracking-[0.2em]">Contraseña</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full pl-14 pr-16 py-5 bg-slate-950/50 border-2 border-slate-800 rounded-[1.5rem] text-white placeholder:text-slate-700 focus:outline-none focus:border-indigo-500/50 transition-all font-bold"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black rounded-[1.5rem] transition-all active:scale-[0.97] shadow-2xl shadow-indigo-600/20 uppercase italic tracking-tighter text-lg flex items-center justify-center gap-3 mt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-300" />
                  Sincronizando...
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowUpRight className="w-5 h-5 stroke-[3px]" />
                </>
              )}
            </button>
          </form>
          
          <p className="text-center text-slate-600 text-[8px] font-black uppercase tracking-[0.5em] mt-10 opacity-50">
            v1.0 
          </p>
        </div>
      </div>
    </div>
  )
}