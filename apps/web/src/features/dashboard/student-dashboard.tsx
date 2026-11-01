import { useNavigate } from 'react-router-dom'
import { FileText, Sparkles, Upload, Download, Plus, AlertCircle, FileBadge, Inbox } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth-context'
import {
  useRequests,
  useDashboardStats,
} from '@/features/requests/hooks/use-requests'
import { DashboardHero } from '@/features/dashboard/widgets/dashboard-hero'
import { KpiGrid, KpiTile } from '@/features/dashboard/widgets/kpi-tile'
import { RequestListPreview, type RequestPreviewItem } from '@/features/dashboard/widgets/request-list-preview'
import { QuickActions, type QuickAction } from '@/features/dashboard/widgets/quick-actions'
import { AlertBanner } from '@/features/dashboard/widgets/alert-banner'
import { Widget } from '@/features/dashboard/widgets/widget'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { EmptyState } from '@/shared/components/empty-state'
import { api } from '@/shared/api'

interface MyDocument {
  id: string
  type: 'CERTIFICATE' | 'CONSTANCY'
  version: number
  request: { id: string; trackingNumber: string; title: string }
  createdAt: string
}

interface StudentProfile {
  program?: string
  semester?: number
  studentCode?: string
}

export function StudentDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => {
      const { data } = await api.get<{ studentProfile?: StudentProfile }>('/api/users/me')
      return data
    },
  })
  const studentProfile = profile?.studentProfile

  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: requestsData, isLoading: requestsLoading } = useRequests({
    page: 1,
    limit: 5,
  })
  const { data: pendingDocs, isLoading: pendingLoading } = useRequests({
    page: 1,
    limit: 5,
    status: 'PENDING_DOCUMENTS',
  })

  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ['my-documents'],
    queryFn: async () => {
      const { data } = await api.get<{ data: MyDocument[]; total: number }>(
        '/api/official-documents?limit=5',
      )
      return data
    },
  })

  const recentItems: RequestPreviewItem[] =
    requestsData?.data?.map((req) => ({
      id: req.id,
      trackingNumber: req.trackingNumber,
      title: req.title,
      status: req.status,
      createdAt: req.createdAt,
      secondary: req.requestType?.name,
    })) ?? []

  const pendingItems: RequestPreviewItem[] =
    pendingDocs?.data?.map((req) => ({
      id: req.id,
      trackingNumber: req.trackingNumber,
      title: req.title,
      status: req.status,
      createdAt: req.updatedAt,
      secondary: req.requestType?.name,
    })) ?? []

  const firstName = user?.fullName?.split(' ')[0] ?? 'estudiante'
  const eyebrow = studentProfile
    ? `Estudiante · ${studentProfile.program} · Sem. ${studentProfile.semester}`
    : 'Estudiante'

  const quickActions: QuickAction[] = [
    {
      label: 'Nueva solicitud',
      description: 'Radicar nuevo trámite',
      href: '/dashboard/requests/new',
      icon: Plus,
      variant: 'accent',
    },
    {
      label: 'Mis solicitudes',
      description: 'Ver todas las solicitudes',
      href: '/dashboard/requests',
      icon: FileText,
    },
    {
      label: 'Documentos oficiales',
      description: 'Resoluciones y certificados',
      href: '/dashboard/documents',
      icon: Download,
    },
  ]

  const hasPending = pendingItems.length > 0

  return (
    <div className="space-y-5 sm:space-y-6">
      <DashboardHero
        eyebrow={eyebrow}
        title={`Hola, ${firstName}`}
        description={
          hasPending
            ? 'Tienes solicitudes esperando tu atención inmediata.'
            : 'No tienes acciones pendientes. Todo está al día.'
        }
        action={
          <Button
            variant="gold"
            size="lg"
            onClick={() => navigate('/dashboard/requests/new')}
            className="h-12 px-6 sm:h-12 rounded-xl shadow-md text-base font-semibold"
          >
            <Sparkles className="mr-2 h-4 w-4 sm:h-4 sm:w-4" aria-hidden="true" />
            Nueva solicitud
          </Button>
        }
      />

      {hasPending && (
        <AlertBanner
          icon={AlertCircle}
          tone="warning"
          title={`${pendingItems.length} solicitud${pendingItems.length === 1 ? '' : 'es'} esperando documentos`}
          description="Sube los documentos solicitados para continuar con la revisión."
          actionLabel="Ver pendientes"
          actionHref="/dashboard/requests?status=PENDING_DOCUMENTS"
        />
      )}

      <KpiGrid columns={4}>
        <KpiTile
          label="Activas"
          value={statsLoading ? '—' : (stats?.draft ?? 0) + (stats?.submitted ?? 0) + (stats?.inReview ?? 0)}
          icon={FileText}
          tone="primary"
        />
        <KpiTile
          label="Aprobadas"
          value={statsLoading ? '—' : (stats?.approved ?? 0)}
          tone="success"
          icon={Sparkles}
        />
        <KpiTile
          label="En revisión"
          value={statsLoading ? '—' : (stats?.submitted ?? 0) + (stats?.inReview ?? 0)}
          tone="warning"
          icon={Upload}
        />
        <KpiTile
          label="Documentos"
          value={docsLoading ? '—' : (docsData?.total ?? 0)}
          tone="info"
          icon={Download}
        />
      </KpiGrid>

      <div className="grid gap-5 sm:gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-5 sm:space-y-6">
          {hasPending && (
            <RequestListPreview
              title="Acciones pendientes"
              description="Solicitudes que requieren tu atención inmediata"
              items={pendingItems.slice(0, 3)}
              loading={pendingLoading}
              emptyTitle="Sin acciones pendientes"
              viewAllHref="/dashboard/requests?status=PENDING_DOCUMENTS"
              viewAllLabel="Ver todas"
            />
          )}

          <RequestListPreview
            title="Mis solicitudes recientes"
            items={recentItems}
            loading={requestsLoading}
            emptyTitle="Aún no tienes solicitudes"
            emptyDescription="Crea tu primera solicitud académica para empezar."
            emptyAction={
              <Button
                variant="gold"
                size="sm"
                onClick={() => navigate('/dashboard/requests/new')}
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                Crear solicitud
              </Button>
            }
            viewAllHref="/dashboard/requests"
            viewAllLabel="Ver todas"
            createHref="/dashboard/requests/new"
            createLabel="Nueva"
          />
        </div>

        <div className="space-y-5 sm:space-y-6">
          <QuickActions title="Acciones rápidas" actions={quickActions} columns={1} />

          <Widget title="Documentos listos" description="Resoluciones y certificados disponibles">
            {docsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : docsData && docsData.data.length > 0 ? (
              <ul className="space-y-1.5 -mx-1">
                {docsData.data.slice(0, 5).map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/documents`)}
                      className="w-full flex items-center gap-3 rounded-lg p-2.5 min-h-[48px] hover:bg-muted/40 active:bg-muted/60 transition-colors text-left"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info-soft text-info shrink-0">
                        <FileBadge className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {doc.type === 'CERTIFICATE' ? 'Certificado' : 'Constancia'} v{doc.version}
                        </p>
                        <p className="text-eyebrow text-muted-foreground truncate">
                          {doc.request.trackingNumber} ·{' '}
                          {new Date(doc.createdAt).toLocaleDateString('es-CO', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Inbox className="h-5 w-5" />}
                title="Sin documentos aún"
                description="Cuando se generen documentos oficiales aparecerán aquí."
              />
            )}
          </Widget>
        </div>
      </div>
    </div>
  )
}
