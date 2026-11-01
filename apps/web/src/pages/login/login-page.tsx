import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth-context'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Eye, EyeOff, AlertCircle, LogIn } from 'lucide-react'
import { AxiosError } from 'axios'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isLoading } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const emailId = 'login-email'
  const passwordId = 'login-password'
  const errorId = 'login-error'

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setEmailError(null)
    setPasswordError(null)

    let hasError = false
    if (!email.trim()) {
      setEmailError('Ingresa tu correo institucional')
      hasError = true
    }
    if (!password.trim()) {
      setPasswordError('Ingresa tu contraseña')
      hasError = true
    }
    if (hasError) return

    setIsSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 401) {
        setError('Correo o contraseña incorrectos. Verifica e intenta de nuevo.')
      } else if (err instanceof AxiosError && err.response?.status === 403) {
        setError('Tu cuenta está inactiva. Contacta al administrador.')
      } else {
        setError('No fue posible iniciar sesión. Verifica tu conexión e intenta de nuevo.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Cargando…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Brand */}
      <div className="space-y-4 text-center">
        <img
          src="/logo-cul.png"
          alt="Logo CUL"
          className="h-14 w-14 rounded-xl mx-auto object-cover border-2 border-gold-500/30"
        />
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-primary font-display">
            Bienvenido
          </h1>
          <p className="text-sm text-muted-foreground">
            Ingresa tus credenciales para acceder al portal académico
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor={emailId}>
            Correo institucional
          </Label>
          <Input
            id={emailId}
            type="email"
            placeholder="usuario@universidad.edu.co"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (emailError) setEmailError(null)
            }}
            disabled={isSubmitting}
            autoComplete="email"
            inputMode="email"
            aria-required="true"
            aria-invalid={emailError ? 'true' : 'false'}
            aria-describedby={emailError ? `${emailId}-error` : undefined}
            className={`h-11 rounded-lg ${emailError ? 'border-danger' : ''}`}
          />
          {emailError && (
            <p id={`${emailId}-error`} className="text-xs text-danger flex items-center gap-1" role="alert">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              {emailError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={passwordId}>
            Contraseña
          </Label>
          <div className="relative">
            <Input
              id={passwordId}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (passwordError) setPasswordError(null)
              }}
              className={`h-11 rounded-lg pr-10 ${passwordError ? 'border-danger' : ''}`}
              disabled={isSubmitting}
              autoComplete="current-password"
              aria-required="true"
              aria-invalid={passwordError ? 'true' : 'false'}
              aria-describedby={passwordError ? `${passwordId}-error` : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {passwordError && (
            <p id={`${passwordId}-error`} className="text-xs text-danger flex items-center gap-1" role="alert">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              {passwordError}
            </p>
          )}
        </div>

        {error && (
          <div
            id={errorId}
            className="rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger flex items-start gap-2"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
          size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              Ingresando…
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
              Iniciar sesión
            </>
          )}
        </Button>
      </form>

      <div className="pt-6 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          ¿Problemas para acceder?{' '}
          <span className="text-primary font-semibold cursor-pointer hover:underline">
            Contacta soporte TI
          </span>
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground/60">
        Sistema de Solicitudes Académicas © {new Date().getFullYear()}
      </p>
    </div>
  )
}
