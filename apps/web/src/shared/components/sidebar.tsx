import { useEffect, useRef, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Settings,
  LogOut,
  X,
  Users,
  Tag,
  ChevronsLeft,
  ChevronsRight,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useAuth } from '@/app/providers/auth-context'
import { usePermissions } from '@/shared/hooks/use-permissions'
import { useDashboardStats } from '@/features/requests/hooks/use-requests'

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
  open?: boolean
  onClose?: () => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getUserGradient(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const gradients = [
    'from-indigo-500 to-purple-500',
    'from-cyan-500 to-teal-500',
    'from-emerald-500 to-green-500',
    'from-amber-500 to-yellow-500',
    'from-red-500 to-rose-500',
    'from-navy-700 to-blue-500',
    'from-violet-500 to-purple-500',
    'from-gold-500 to-amber-500',
  ]
  return gradients[hash % gradients.length]
}

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
}

function SidebarSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-2" role="group" aria-label={label}>
      <p
        className="text-eyebrow font-bold uppercase tracking-widest text-sidebar-muted-foreground px-4 pt-3 pb-1.5"
        id={`sidebar-section-${label.toLowerCase()}`}
      >
        {label}
      </p>
      <div className="space-y-0.5" role="list" aria-labelledby={`sidebar-section-${label.toLowerCase()}`}>
        {children}
      </div>
    </div>
  )
}

function NavItemLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  collapsed: boolean
  onNavigate?: () => void
}) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/dashboard'}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      role="listitem"
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200',
          collapsed ? 'justify-center h-10 w-10 mx-auto' : 'px-3 h-11 sm:h-10',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
            : 'text-sidebar-muted hover:bg-sidebar-border/40 hover:text-sidebar-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn(
              'h-[18px] w-[18px] shrink-0',
              isActive ? 'text-gold-400' : 'text-sidebar-muted group-hover:text-sidebar-foreground',
            )}
            aria-hidden="true"
          />
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-eyebrow font-bold text-white"
                  aria-label={`${item.badge} pendiente${item.badge === 1 ? '' : 's'}`}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </>
          )}
          {collapsed && (
            <span className="sr-only">{item.label}</span>
          )}
        </>
      )}
    </NavLink>
  )
}

export function Sidebar({ collapsed = false, onToggle, open = false, onClose }: SidebarProps) {
  const { logout, user } = useAuth()
  const { isReviewer, isAdmin } = usePermissions()
  const { data: stats } = useDashboardStats()
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  const initials = user?.fullName ? getInitials(user.fullName) : 'U'
  const gradient = user?.fullName ? getUserGradient(user.fullName) : 'from-navy-700 to-blue-500'

  const pendingCount = isReviewer ? (stats?.submitted ?? 0) + (stats?.inReview ?? 0) : 0

  const dashboardItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/dashboard/requests', label: 'Solicitudes', icon: FileText, badge: pendingCount },
  ]

  const managementItems: NavItem[] = isAdmin
    ? [
        { to: '/dashboard/admin/users', label: 'Usuarios', icon: Users },
        { to: '/dashboard/admin/request-types', label: 'Tipos de solicitud', icon: Tag },
      ]
    : []

  const systemItems: NavItem[] = [
    { to: '/dashboard/documents', label: 'Documentos', icon: FolderOpen },
    { to: '/dashboard/notifications', label: 'Notificaciones', icon: Bell },
    { to: '/dashboard/settings', label: 'Configuración', icon: Settings },
  ]

  // ESC cierra el drawer mobile + focus trap
  useEffect(() => {
    if (!open) return

    previouslyFocused.current = (document.activeElement as HTMLElement) || null

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKey)

    // Mover foco al botón de cerrar
    const t = window.setTimeout(() => {
      closeButtonRef.current?.focus()
    }, 50)

    return () => {
      document.removeEventListener('keydown', handleKey)
      window.clearTimeout(t)
    }
  }, [open, onClose])

  // Restaurar foco al cerrar
  useEffect(() => {
    if (!open) {
      const prev = previouslyFocused.current
      if (prev && typeof prev.focus === 'function') {
        const t = window.setTimeout(() => prev.focus(), 0)
        return () => window.clearTimeout(t)
      }
    }
  }, [open])

  const sidebarContent = (
    <aside
      className={cn(
        'flex h-full flex-col bg-sidebar border-r border-sidebar-border',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-16' : 'w-60',
      )}
      aria-label="Navegación principal"
    >
      {/* Brand */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-sidebar-border shrink-0',
          collapsed ? 'justify-center px-2' : 'gap-3 px-5',
        )}
      >
        <img
          src="/logo-cul.png"
          alt="CUL"
          className="h-9 w-9 rounded-lg object-cover shrink-0"
        />
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-sidebar-foreground leading-tight font-display truncate">
              SOLICITUDES
            </span>
            <span className="text-eyebrow font-medium text-sidebar-muted-foreground leading-tight truncate">
              Portal Académico
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Menú principal">
        <SidebarSection label="Principal">
          {dashboardItems.map((item) => (
            <NavItemLink
              key={item.to}
              item={item}
              collapsed={collapsed}
              onNavigate={onClose}
            />
          ))}
        </SidebarSection>

        {managementItems.length > 0 && (
          <SidebarSection label="Gestión">
            {managementItems.map((item) => (
              <NavItemLink
                key={item.to}
                item={item}
                collapsed={collapsed}
                onNavigate={onClose}
              />
            ))}
          </SidebarSection>
        )}

        <SidebarSection label="Sistema">
          {systemItems.map((item) => (
            <NavItemLink
              key={item.to}
              item={item}
              collapsed={collapsed}
              onNavigate={onClose}
            />
          ))}
        </SidebarSection>
      </nav>

      {/* Footer: collapse toggle (desktop) + user */}
      <div className="border-t border-sidebar-border shrink-0">
        {/* Toggle collapse — solo desktop (lg+) */}
        {onToggle && (
          <div className="hidden lg:flex items-center justify-end px-2 py-2 border-b border-sidebar-border">
            <button
              type="button"
              onClick={onToggle}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-border hover:text-sidebar-foreground transition-colors"
              title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
              aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        )}

        {user && (
          <div
            className={cn('flex items-center gap-3', collapsed ? 'justify-center p-2' : 'px-3 py-3')}
            role="region"
            aria-label="Información del usuario actual"
          >
            <div className="relative shrink-0">
              <div
                className={cn(
                  'rounded-xl flex items-center justify-center text-white font-bold font-display text-xs bg-gradient-to-br',
                  collapsed ? 'h-9 w-9' : 'h-10 w-10',
                  gradient,
                )}
                aria-hidden="true"
              >
                {initials}
              </div>
              <span
                className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-sidebar rounded-full"
                aria-label="En línea"
                role="status"
              />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold text-sidebar-foreground truncate">
                  {user.fullName}
                </h4>
                <p className="text-eyebrow text-sidebar-muted-foreground truncate">
                  {user.role === 'ADMIN'
                    ? 'Administrador'
                    : user.role === 'STUDENT'
                      ? 'Estudiante'
                      : user.role}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={() => logout()}
                className="h-9 w-9 inline-flex items-center justify-center text-sidebar-muted hover:bg-sidebar-border hover:text-sidebar-foreground transition-colors rounded-md shrink-0"
                title="Cerrar sesión"
                aria-label={`Cerrar sesión de ${user.fullName ?? 'usuario actual'}`}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop: sidebar fija en flow */}
      <div
        className={cn(
          'hidden lg:flex shrink-0',
          collapsed ? 'w-16' : 'w-60',
          'transition-[width] duration-200 ease-out',
        )}
      >
        {sidebarContent}
      </div>

      {/* Mobile: drawer overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        ref={drawerRef}
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-80 max-w-[90vw] transform transition-transform duration-200 ease-out shadow-2xl',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        aria-hidden={!open}
        {...(!open ? { inert: '' as unknown as boolean } : {})}
      >
        {sidebarContent}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 h-10 w-10 inline-flex items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-border hover:text-sidebar-foreground"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </>
  )
}

// Re-export para que el toggle del Topbar pueda usar el mismo icono
export { ChevronsLeft, ChevronsRight }
