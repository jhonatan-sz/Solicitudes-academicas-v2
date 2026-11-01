import { useNavigate } from 'react-router-dom'
import { Users, FileText, Tag, TrendingUp, Shield, Activity, Database, AlertCircle, UserCheck } from 'lucide-react'
import { useRequests, useDashboardStats } from '@/features/requests/hooks/use-requests'
import { useUsersStats, useUsers } from '@/features/admin/hooks/use-users'
import { useRequestTypes } from '@/features/requests/hooks/use-requests'
import { DashboardHero } from '@/features/dashboard/widgets/dashboard-hero'
import { KpiGrid, KpiTile } from '@/features/dashboard/widgets/kpi-tile'
import { RequestListPreview, type RequestPreviewItem } from '@/features/dashboard/widgets/request-list-preview'
import { QuickActions, type QuickAction } from '@/features/dashboard/widgets/quick-actions'
import { AlertBanner } from '@/features/dashboard/widgets/alert-banner'
import { Widget } from '@/features/dashboard/widgets/widget'
import { useAuth } from '@/app/providers/auth-context'

export function AdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: usersStats, isLoading: usersStatsLoading } = useUsersStats()
  const { data: usersData } = useUsers({ page: 1, limit: 5 })
  const { data: typesData, isLoading: typesLoading } = useRequestTypes()

  const { data: recentData, isLoading: recentLoading } = useRequests({
    page: 1,
    limit: 5,
  })

  const totalUsers = usersStats?.total ?? 0
  const activeUsers = usersStats?.active ?? 0
  const studentUsers = usersStats?.students ?? 0
  const totalRequests = stats
    ? stats.draft + stats.submitted + stats.inReview + stats.approved + stats.rejected + stats.cancelled
    : 0
  const approvalRate =
    stats && stats.approved + stats.rejected > 0
      ? (stats.approved / (stats.approved + stats.rejected)) * 100
      : 0

  const statusDistribution = stats
    ? [
        { key: 'APPROVED', label: 'Aprobadas', value: stats.approved, color: 'bg-success' },
        { key: 'DRAFT', label: 'Borradores', value: stats.draft, color: 'bg-gold-500' },
        { key: 'IN_REVIEW', label: 'En revisión', value: stats.inReview, color: 'bg-info' },
        { key: 'SUBMITTED', label: 'Enviadas', value: stats.submitted, color: 'bg-warning' },
        { key: 'REJECTED', label: 'Rechazadas', value: stats.rejected, color: 'bg-danger' },
        {
          key: 'CANCELLED',
          label: 'Canceladas',
          value: stats.cancelled,
          color: 'bg-muted-foreground',
        },
      ].filter((s) => s.value > 0)
    : []

  const maxStatus = Math.max(1, ...statusDistribution.map((s) => s.value))

  const recentItems: RequestPreviewItem[] =
    recentData?.data?.map((req) => ({
      id: req.id,
      trackingNumber: req.trackingNumber,
      title: req.title,
      status: req.status,
      createdAt: req.createdAt,
      primary: req.user?.fullName,
      secondary: req.requestType?.name,
    })) ?? []

  const firstName = user?.fullName?.split(' ')[0] ?? 'administrador'
  const pendingDocsCount = stats?.submitted ?? 0
  const activeTypes = typesData?.filter((t) => t.isActive).length ?? 0
  const totalTypes = typesData?.length ?? 0

  const quickActions: QuickAction[] = [
    {
      label: 'Gestionar usuarios',
      description: `${totalUsers} usuarios · ${activeUsers} activos`,
      href: '/dashboard/admin/users',
      icon: Users,
    },
    {
      label: 'Tipos de solicitud',
      description: `${activeTypes} de ${totalTypes} activos`,
      href: '/dashboard/admin/request-types',
      icon: Tag,
    },
    {
      label: 'Ver solicitudes',
      description: 'Listado completo',
      href: '/dashboard/requests',
      icon: FileText,
    },
  ]

  return (
    <div className="space-y-5 sm:space-y-6">
      <DashboardHero
        eyebrow="Administración del sistema"
        title={`Hola, ${firstName}`}
        description="Visión general de la salud operativa y la actividad del sistema."
      />

      {pendingDocsCount > 20 && (
        <AlertBanner
          icon={AlertCircle}
          tone="warning"
          title="Acumulación de solicitudes"
          description={`Hay ${pendingDocsCount} solicitudes enviadas esperando atención.`}
          actionLabel="Ver cola"
          actionHref="/dashboard/requests?status=SUBMITTED"
        />
      )}

      <KpiGrid columns={4}>
        <KpiTile
          label="Usuarios activos"
          value={usersStatsLoading ? '—' : activeUsers}
          trend={usersStatsLoading ? '' : `${totalUsers} totales`}
          icon={UserCheck}
          tone="primary"
        />
        <KpiTile
          label="Solicitudes activas"
          value={statsLoading ? '—' : pendingDocsCount + (stats?.inReview ?? 0)}
          trend={statsLoading ? '' : `${totalRequests} totales`}
          icon={Activity}
          tone="info"
        />
        <KpiTile
          label="Tipos activos"
          value={typesLoading ? '—' : `${activeTypes}/${totalTypes}`}
          icon={Tag}
          tone="success"
        />
        <KpiTile
          label="Aprobación"
          value={statsLoading ? '—' : `${Math.round(approvalRate)}%`}
          icon={TrendingUp}
          tone="success"
        />
      </KpiGrid>

      {statusDistribution.length > 0 && (
        <Widget title="Distribución operativa" description="Estado global de las solicitudes">
          <div className="space-y-2.5">
            {statusDistribution.map((s) => (
              <div key={s.key} className="flex items-center gap-2.5 sm:gap-3">
                <span className="text-sm text-foreground w-24 sm:w-32 shrink-0 truncate">
                  {s.label}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-0">
                  <div
                    className={`h-full ${s.color} transition-all`}
                    style={{ width: `${(s.value / maxStatus) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground w-8 sm:w-12 text-right tabular-nums shrink-0">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </Widget>
      )}

      <div className="grid gap-5 sm:gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-5 sm:space-y-6">
          <RequestListPreview
            title="Solicitudes recientes"
            items={recentItems}
            loading={recentLoading}
            emptyTitle="Sin solicitudes recientes"
            viewAllHref="/dashboard/requests"
            viewAllLabel="Ver todas"
            onItemClick={(item) => navigate(`/dashboard/requests/${item.id}`)}
          />

          {usersData && usersData.data.length > 0 && (
            <Widget title="Usuarios recientes" description={`${totalUsers} usuarios en el sistema`}>
              <ul className="divide-y divide-border -mx-4 sm:-mx-5">
                {usersData.data.map((u) => (
                  <li
                    key={u.id}
                    className="px-4 py-3 sm:px-5 flex items-center gap-3 hover:bg-muted/40 active:bg-muted/60 cursor-pointer transition-colors min-h-[60px]"
                    onClick={() => navigate('/dashboard/admin/users')}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs shrink-0">
                      {u.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {u.fullName}
                      </p>
                      <p className="text-eyebrow text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>
                    <span
                      className={`text-eyebrow font-semibold shrink-0 ${
                        u.isActive ? 'text-success' : 'text-muted-foreground'
                      }`}
                    >
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </li>
                ))}
              </ul>
            </Widget>
          )}
        </div>

        <div className="space-y-5 sm:space-y-6">
          <QuickActions title="Acciones rápidas" actions={quickActions} columns={1} />

          <Widget title="Resumen del sistema">
            <dl className="space-y-2.5 sm:space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" /> Estudiantes
                </dt>
                <dd className="font-semibold text-foreground tabular-nums">{studentUsers}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" /> Solicitudes totales
                </dt>
                <dd className="font-semibold text-foreground tabular-nums">{totalRequests}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5" /> Tipos configurados
                </dt>
                <dd className="font-semibold text-foreground tabular-nums">{totalTypes}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5" /> Roles
                </dt>
                <dd className="font-semibold text-foreground tabular-nums">4</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Database className="h-3.5 w-3.5" /> Salud del sistema
                </dt>
                <dd className="font-semibold text-success">Operativo</dd>
              </div>
            </dl>
          </Widget>
        </div>
      </div>
    </div>
  )
}
