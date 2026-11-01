import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, Clock, FileText, Sparkles, Scale, AlertCircle } from 'lucide-react'
import { useRequests, useDashboardStats } from '@/features/requests/hooks/use-requests'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api'
import { DashboardHero } from '@/features/dashboard/widgets/dashboard-hero'
import { KpiGrid, KpiTile } from '@/features/dashboard/widgets/kpi-tile'
import { RequestListPreview, type RequestPreviewItem } from '@/features/dashboard/widgets/request-list-preview'
import { QuickActions, type QuickAction } from '@/features/dashboard/widgets/quick-actions'
import { AlertBanner } from '@/features/dashboard/widgets/alert-banner'
import { Widget } from '@/features/dashboard/widgets/widget'
import { useAuth } from '@/app/providers/auth-context'

interface RequestTypeStat {
  total: number
  thisMonth: number
  approvalRate: number
}

export function CoordinatorDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: stats, isLoading: statsLoading } = useDashboardStats()

  const { data: pendingData, isLoading: pendingLoading } = useRequests({
    page: 1,
    limit: 8,
    status: 'IN_REVIEW',
  })

  const { data: approvedData } = useRequests({
    page: 1,
    limit: 5,
    status: 'APPROVED',
  })

  const { data: rejectedData } = useRequests({
    page: 1,
    limit: 5,
    status: 'REJECTED',
  })

  const pendingItems: RequestPreviewItem[] =
    pendingData?.data?.map((req) => ({
      id: req.id,
      trackingNumber: req.trackingNumber,
      title: req.title,
      status: req.status,
      createdAt: req.updatedAt,
      primary: req.user?.fullName,
      secondary: req.requestType?.name,
    })) ?? []

  const approvedItems: RequestPreviewItem[] =
    approvedData?.data?.map((req) => ({
      id: req.id,
      trackingNumber: req.trackingNumber,
      title: req.title,
      status: req.status,
      createdAt: req.updatedAt,
      primary: req.user?.fullName,
      secondary: req.requestType?.name,
    })) ?? []

  const rejectedItems: RequestPreviewItem[] =
    rejectedData?.data?.map((req) => ({
      id: req.id,
      trackingNumber: req.trackingNumber,
      title: req.title,
      status: req.status,
      createdAt: req.updatedAt,
      primary: req.user?.fullName,
      secondary: req.requestType?.name,
    })) ?? []

  const { data: typesData } = useQuery({
    queryKey: ['request-types-stats'],
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: string; name: string }[] }>(
        '/api/requests/types/all',
      )
      const statsResults = await Promise.all(
        data.data.slice(0, 5).map(async (t) => {
          try {
            const { data: st } = await api.get<RequestTypeStat>(
              `/api/requests/types/${t.id}/stats`,
            )
            return { id: t.id, name: t.name, ...st }
          } catch {
            return null
          }
        }),
      )
      return statsResults.filter(Boolean) as Array<RequestTypeStat & { id: string; name: string }>
    },
  })

  const firstName = user?.fullName?.split(' ')[0] ?? 'coordinador'
  const pendingCount = stats?.inReview ?? 0
  const approvedCount = stats?.approved ?? 0
  const rejectedCount = stats?.rejected ?? 0

  const quickActions: QuickAction[] = [
    {
      label: 'Revisar decisiones pendientes',
      description: `${pendingCount} solicitudes en revisión`,
      href: '/dashboard/requests?status=IN_REVIEW',
      icon: Scale,
      variant: 'accent',
    },
    {
      label: 'Ver todas las solicitudes',
      description: 'Listado completo',
      href: '/dashboard/requests',
      icon: FileText,
    },
    {
      label: 'Documentos generados',
      description: 'Resoluciones oficiales',
      href: '/dashboard/documents',
      icon: Sparkles,
    },
  ]

  return (
    <div className="space-y-5 sm:space-y-6">
      <DashboardHero
        eyebrow="Coordinador académico"
        title={`Hola, ${firstName}`}
        description={
          pendingCount > 0
            ? `Tienes ${pendingCount} solicitud${pendingCount === 1 ? '' : 'es'} esperando tu decisión.`
            : 'No hay decisiones pendientes.'
        }
      />

      {pendingCount > 10 && (
        <AlertBanner
          icon={AlertCircle}
          tone="warning"
          title="Acumulación de decisiones"
          description={`Hay ${pendingCount} solicitudes en revisión. Considera priorizar las más antiguas.`}
          actionLabel="Ver cola"
          actionHref="/dashboard/requests?status=IN_REVIEW"
        />
      )}

      <KpiGrid columns={4}>
        <KpiTile
          label="Pendientes"
          value={statsLoading ? '—' : pendingCount}
          icon={Scale}
          tone="warning"
        />
        <KpiTile
          label="Aprobadas"
          value={statsLoading ? '—' : approvedCount}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiTile
          label="Rechazadas"
          value={statsLoading ? '—' : rejectedCount}
          icon={XCircle}
          tone="danger"
        />
        <KpiTile
          label="Total activas"
          value={statsLoading ? '—' : (stats?.submitted ?? 0) + pendingCount}
          icon={Clock}
          tone="info"
        />
      </KpiGrid>

      <div className="grid gap-5 sm:gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-5 sm:space-y-6">
          <RequestListPreview
            title="Pendientes de decisión"
            description="Solicitudes en IN_REVIEW que esperan aprobación o rechazo"
            items={pendingItems}
            loading={pendingLoading}
            emptyTitle="Sin decisiones pendientes"
            emptyDescription="Todas las solicitudes en revisión han sido decididas."
            viewAllHref="/dashboard/requests?status=IN_REVIEW"
            viewAllLabel="Ver todas"
            onItemClick={(item) => navigate(`/dashboard/requests/${item.id}`)}
          />

          {typesData && typesData.length > 0 && (
            <Widget title="Tasa de aprobación por tipo" description="Top 5 tipos de solicitud">
              <ul className="space-y-3 sm:space-y-3.5">
                {typesData.map((t) => (
                  <li key={t.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {t.name}
                      </span>
                      <span className="text-eyebrow font-semibold text-muted-foreground shrink-0 tabular-nums">
                        {Math.round(t.approvalRate)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-success"
                        style={{ width: `${Math.min(100, t.approvalRate)}%` }}
                      />
                    </div>
                    <p className="text-eyebrow text-muted-foreground">
                      {t.total} totales · {t.thisMonth} este mes
                    </p>
                  </li>
                ))}
              </ul>
            </Widget>
          )}
        </div>

        <div className="space-y-5 sm:space-y-6">
          <QuickActions title="Acciones rápidas" actions={quickActions} columns={1} />

          {approvedItems.length > 0 && (
            <RequestListPreview
              title="Aprobadas recientes"
              items={approvedItems}
              emptyTitle="Sin aprobaciones recientes"
              viewAllHref="/dashboard/requests?status=APPROVED"
              viewAllLabel="Ver todas"
            />
          )}

          {rejectedItems.length > 0 && (
            <RequestListPreview
              title="Rechazadas recientes"
              items={rejectedItems}
              emptyTitle="Sin rechazos recientes"
              viewAllHref="/dashboard/requests?status=REJECTED"
              viewAllLabel="Ver todas"
            />
          )}
        </div>
      </div>
    </div>
  )
}
