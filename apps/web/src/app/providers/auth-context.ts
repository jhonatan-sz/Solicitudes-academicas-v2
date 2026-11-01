import { createContext, useContext } from 'react'
import type { AuthUser } from '@/shared/types'

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

/**
 * Contexto y hook viven fuera del componente para que `auth-provider.tsx`
 * solo exporte el componente: así Fast Refresh funciona sin excepciones.
 */
export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
