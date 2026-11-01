import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AuthUser } from '@/shared/types'
import { loginApi, refreshApi, logoutApi, meApi } from '@/features/auth/api/auth-api'
import { configureAuthInterceptors } from '@/shared/api/client'
import { AuthContext } from './auth-context'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const setAccessToken = (token: string | null) => {
    accessTokenRef.current = token
  }

  const getAccessToken = () => accessTokenRef.current

  useEffect(() => {
    configureAuthInterceptors(getAccessToken, () => {
      setUser(null)
      setAccessToken(null)
      setIsAuthenticated(false)
    }, setAccessToken)
  }, [])

  useEffect(() => {
    let cancelled = false

    const initSession = async () => {
      try {
        const response = await refreshApi()
        if (cancelled) return

        setAccessToken(response.accessToken)
        const profile = await meApi()
        if (cancelled) return

        setUser(profile)
        setIsAuthenticated(true)
      } catch {
        if (cancelled) return
        setUser(null)
        setAccessToken(null)
        setIsAuthenticated(false)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    initSession()
    return () => {
      cancelled = true
    }
  }, [])

  const login = async (email: string, password: string) => {
    const response = await loginApi(email, password)
    setAccessToken(response.accessToken)
    setUser(response.user)
    setIsAuthenticated(true)
  }

  const logout = async () => {
    try {
      await logoutApi()
    } catch {
      // best-effort: even if server fails, clear local state
    } finally {
      setUser(null)
      setAccessToken(null)
      setIsAuthenticated(false)
      window.location.href = '/login'
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
