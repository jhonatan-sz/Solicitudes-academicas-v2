import { api } from '@/shared/api'
import type { AuthUser, LoginResponse, RefreshResponse } from '@/shared/types'

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/auth/login', { email, password })
  return data
}

let refreshInFlight: Promise<RefreshResponse> | null = null

/**
 * Deduplica las peticiones de refresh concurrentes.
 *
 * Al recargar, React StrictMode monta el efecto dos veces en desarrollo y
 * ambas llamadas compiten contra un refresh token rotativo: la segunda llega
 * con el token ya consumido y tumba la sesión. Con una sola petición en vuelo,
 * las dos esperan el mismo resultado.
 */
export function refreshApi(): Promise<RefreshResponse> {
  refreshInFlight ??= api
    .post<RefreshResponse>('/api/auth/refresh')
    .then(({ data }) => data)
    .finally(() => {
      refreshInFlight = null
    })

  return refreshInFlight
}

export async function logoutApi(): Promise<void> {
  await api.post('/api/auth/logout')
}

export async function meApi(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>('/api/auth/me')
  return data
}
