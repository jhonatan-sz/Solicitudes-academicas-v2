import { Navigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth-provider'

export function CatchAllRedirect() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
}
