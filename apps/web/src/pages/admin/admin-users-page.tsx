import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useUsers,
  useRoles,
  useUsersStats,
  useUserRequestStats,
  useUserActivity,
  useCreateUser,
  useUpdateUser,
  useUpdateUserStatus,
  useDeleteUser,
} from '@/features/admin/hooks/use-users'
import {
  DetailDrawer,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerSection,
  DrawerDetailRow,
  DrawerStatPill,
  DrawerEmptyState,
  DrawerActivityItem,
} from '@/shared/components/detail-drawer'
import { KpiCard } from '@/shared/components/kpi-card'
import { PageHeader } from '@/shared/components/page-header'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu'
import { Badge } from '@/shared/components/ui/badge'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Label } from '@/shared/components/ui/label'
import { DeleteConfirmationDialog } from '@/shared/components/delete-confirmation-dialog'
import { FilterChip } from '@/shared/components/filter-chip'
import { DataView } from '@/shared/components/data-view'
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  UserCheck,
  UserX,
  GraduationCap,
  Loader2,
  X,
  Eye,
  MoreVertical,
} from 'lucide-react'
import type { AdminUser, RoleName, CreateUserInput } from '@/shared/types'
import { cn } from '@/shared/lib/utils'

const ROLE_CONFIG: Record<RoleName, { variant: string; label: string }> = {
  ADMIN: { variant: 'role-admin', label: 'Admin' },
  COORDINATOR: { variant: 'role-coordinator', label: 'Coordinador' },
  STAFF: { variant: 'role-staff', label: 'Staff' },
  STUDENT: { variant: 'role-student', label: 'Estudiante' },
}

const createUserSchema = z.object({
  fullName: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Correo inválido'),
  documentNumber: z.string().min(5, 'Mínimo 5 caracteres'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  roleId: z.string().min(1, 'Selecciona un rol'),
  program: z.string().optional(),
  semester: z.number().min(1).max(12).optional(),
  studentCode: z.string().optional(),
})

const editUserSchema = z.object({
  fullName: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Correo inválido'),
  documentNumber: z.string().min(5, 'Mínimo 5 caracteres'),
  roleId: z.string().min(1, 'Selecciona un rol'),
  program: z.string().optional(),
  semester: z.number().min(1).max(12).optional(),
  studentCode: z.string().optional(),
})

type CreateUserForm = z.infer<typeof createUserSchema>
type EditUserForm = z.infer<typeof editUserSchema>

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getAvatarGradient(name: string): string {
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

export function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Number(searchParams.get('page')) || 1
  const search = searchParams.get('search') || undefined
  const roleFilter = searchParams.get('role') || undefined
  const isActiveFilter = searchParams.get('isActive')
  const parsedIsActive = isActiveFilter === 'true' ? true : isActiveFilter === 'false' ? false : undefined

  const { data, isLoading, isError, refetch } = useUsers({ page, search, role: roleFilter, isActive: parsedIsActive, limit: 20 })
  const { data: roles } = useRoles()
  const { data: statsData } = useUsersStats()
  const { mutate: create, isPending: creating } = useCreateUser()
  const { mutate: update, isPending: updating } = useUpdateUser()
  const { mutate: toggleStatus, isPending: toggling } = useUpdateUserStatus()
  const { mutate: remove, isPending: deleting } = useDeleteUser()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [toggleTarget, setToggleTarget] = useState<AdminUser | null>(null)
  const [drawerUser, setDrawerUser] = useState<AdminUser | null>(null)
  const { data: userRequestStats } = useUserRequestStats(drawerUser?.id ?? '')
  const { data: userActivity, isLoading: activityLoading } = useUserActivity(drawerUser?.id ?? '')

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    params.set('page', '1')
    setSearchParams(params)
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(newPage))
    setSearchParams(params)
  }

  const users = data?.data ?? []

  const kpis = {
    total: statsData?.total ?? 0,
    active: statsData?.active ?? 0,
    inactive: statsData?.inactive ?? 0,
    students: statsData?.students ?? 0,
  }

  const hasActiveFilters = search || roleFilter || isActiveFilter

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Directorio Institucional"
        title="Usuarios del Sistema"
        description="Gestión de cuentas, roles y permisos del portal académico"
        actions={
          <Button variant="gold" size="sm" onClick={() => setCreateOpen(true)} className="w-full sm:w-auto h-10 sm:h-9">
            <Plus className="h-3.5 w-3.5" />
            Nuevo usuario
          </Button>
        }
      />

      {/* KPI Strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Usuarios"
          value={kpis.total}
          icon={Users}
          variant="primary"
          trend="En el sistema"
          loading={isLoading && !statsData}
        />
        <KpiCard
          label="Activos"
          value={kpis.active}
          icon={UserCheck}
          variant="success"
          trend="Con acceso"
          loading={isLoading && !statsData}
        />
        <KpiCard
          label="Inactivos"
          value={kpis.inactive}
          icon={UserX}
          variant="danger"
          trend="Sin acceso"
          loading={isLoading && !statsData}
        />
        <KpiCard
          label="Estudiantes"
          value={kpis.students}
          icon={GraduationCap}
          variant="info"
          trend="Ing. Sistemas"
          loading={isLoading && !statsData}
        />
      </div>

      {/* Toolbar + Tabla con DataView */}
      <DataView<AdminUser>
        mode="table"
        data={data ? { data: users, total: data.total, page: data.page, totalPages: data.totalPages } : undefined}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        search={search ?? ''}
        searchPlaceholder="Buscar por nombre, correo o documento..."
        onSearchChange={(v) => setParam('search', v || null)}
        filters={
          <>
            <Select value={roleFilter ?? 'all'} onValueChange={(v) => setParam('role', v === 'all' ? null : v)}>
              <SelectTrigger className="h-10 sm:h-9 w-full sm:w-[160px]">
                <SelectValue placeholder="Todos los roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {roles?.map((r) => (
                  <SelectItem key={r.id} value={r.name}>
                    {ROLE_CONFIG[r.name]?.label ?? r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={isActiveFilter ?? 'all'}
              onValueChange={(v) => setParam('isActive', v === 'all' ? null : v)}
            >
              <SelectTrigger className="h-10 sm:h-9 w-full sm:w-[150px]">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Activos</SelectItem>
                <SelectItem value="false">Inactivos</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchParams({})}
                className="h-10 sm:h-9 w-full sm:w-auto"
              >
                <X className="mr-1 h-3 w-3" />
                Limpiar
              </Button>
            )}
          </>
        }
        activeFilters={
          <>
            {search && (
              <FilterChip
                label={`Búsqueda: "${search}"`}
                onRemove={() => setParam('search', null)}
              />
            )}
            {roleFilter && (
              <FilterChip
                label={`Rol: ${ROLE_CONFIG[roleFilter as RoleName]?.label ?? roleFilter}`}
                onRemove={() => setParam('role', null)}
              />
            )}
            {isActiveFilter && (
              <FilterChip
                label={`Estado: ${isActiveFilter === 'true' ? 'Activos' : 'Inactivos'}`}
                onRemove={() => setParam('isActive', null)}
              />
            )}
          </>
        }
        emptyTitle="No se encontraron usuarios"
        emptyDescription={
          hasActiveFilters
            ? 'Intenta cambiar los filtros de búsqueda'
            : 'Crea el primer usuario del sistema'
        }
        emptyIcon={<Users className="h-6 w-6" />}
        columns={[
          {
            key: 'user',
            header: 'Usuario',
            cell: (user) => (
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={cn(
                    'h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-eyebrow font-bold text-white bg-gradient-to-br',
                    getAvatarGradient(user.fullName),
                  )}
                >
                  {getInitials(user.fullName)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{user.fullName}</p>
                  {user.studentProfile && (
                    <p className="text-eyebrow text-muted-foreground truncate">
                      {user.studentProfile.program} — Sem. {user.studentProfile.semester}
                    </p>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'email',
            header: 'Correo',
            hideOnMobile: true,
            cell: (user) => (
              <span className="text-sm text-muted-foreground truncate">{user.email}</span>
            ),
          },
          {
            key: 'document',
            header: 'Documento',
            width: '140px',
            hideOnMobile: true,
            cell: (user) => (
              <span className="text-eyebrow font-mono text-muted-foreground">
                {user.documentNumber}
              </span>
            ),
          },
          {
            key: 'role',
            header: 'Rol',
            width: '120px',
            cell: (user) => (
              <Badge variant={ROLE_CONFIG[user.role.name]?.variant as never} className="text-eyebrow">
                {ROLE_CONFIG[user.role.name]?.label}
              </Badge>
            ),
          },
        {
          key: 'status',
          header: 'Estado',
          width: '110px',
          cell: (user) => (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setToggleTarget(user)
              }}
              disabled={toggling}
              className="cursor-pointer min-h-[32px] inline-flex items-center"
            >
              <Badge
                variant={user.isActive ? 'active' : 'inactive'}
                className="cursor-pointer text-eyebrow"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    user.isActive ? 'bg-success' : 'bg-muted-foreground/50'
                  }`}
                />
                {user.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </button>
          ),
        },
          {
            key: 'createdAt',
            header: 'Fecha',
            width: '110px',
            hideOnMobile: true,
            cell: (user) => (
              <span className="text-eyebrow text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString('es-CO', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            ),
          },
        {
          key: 'actions',
          header: '',
          align: 'right',
          width: '60px',
          cell: (user) => (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="h-9 w-9">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => setDrawerUser(user)}>
                    <Eye className="mr-2 h-3.5 w-3.5" />
                    Ver detalle
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditTarget(user)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteTarget(user)}
                    className="text-danger focus:text-danger"
                    disabled={deleting}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ),
        },
        ]}
        rowKey={(user) => user.id}
        onRowClick={(user) => setDrawerUser(user)}
        pagination={
          data
            ? {
                page: data.page,
                totalPages: data.totalPages,
                totalItems: data.total,
                pageSize: data.limit,
                onPageChange: handlePageChange,
              }
            : undefined
        }
      />

      {/* Detail Drawer */}
      <DetailDrawer open={!!drawerUser} onClose={() => setDrawerUser(null)}>
        {drawerUser && (
          <>
            <DrawerHeader
              eyebrow="Perfil de Usuario"
              title={drawerUser.fullName}
              subtitle={drawerUser.email}
              badges={
                <>
                  <Badge variant={ROLE_CONFIG[drawerUser.role.name]?.variant as never} className="text-eyebrow">
                    {ROLE_CONFIG[drawerUser.role.name]?.label}
                  </Badge>
                  <Badge variant={drawerUser.isActive ? 'active' : 'inactive'} className="text-eyebrow">
                    <span className={`h-1.5 w-1.5 rounded-full ${drawerUser.isActive ? 'bg-success' : 'bg-muted-foreground/50'}`} />
                    {drawerUser.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </>
              }
              onClose={() => setDrawerUser(null)}
            />
            <DrawerBody>
              <DrawerSection title="Datos Básicos">
                <DrawerDetailRow label="Documento" value={<span className="font-mono">{drawerUser.documentNumber}</span>} />
                {drawerUser.studentProfile && (
                  <>
                    <DrawerDetailRow label="Programa" value={drawerUser.studentProfile.program} />
                    <DrawerDetailRow label="Semestre" value={drawerUser.studentProfile.semester.toString()} />
                    <DrawerDetailRow label="Código" value={<span className="font-mono">{drawerUser.studentProfile.studentCode}</span>} />
                  </>
                )}
                <DrawerDetailRow label="Rol asignado" value={ROLE_CONFIG[drawerUser.role.name]?.label ?? drawerUser.role.name} />
                <DrawerDetailRow
                  label="Fecha registro"
                  value={new Date(drawerUser.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                />
              </DrawerSection>

              <DrawerSection title="Solicitudes Creadas">
                <div className="flex gap-2 flex-wrap">
                  <DrawerStatPill value={userRequestStats?.total ?? 0} label="Total" />
                  <DrawerStatPill value={userRequestStats?.approved ?? 0} label="Aprobadas" valueColor="text-success" />
                  <DrawerStatPill value={userRequestStats?.draft ?? 0} label="Borradores" valueColor="text-muted-foreground" />
                  <DrawerStatPill value={userRequestStats?.pending ?? 0} label="Pendientes" valueColor="text-warning" />
                </div>
                {(userRequestStats?.total ?? 0) === 0 && (
                  <p className="text-eyebrow text-muted-foreground mt-2">Sin solicitudes registradas aún</p>
                )}
              </DrawerSection>

              <DrawerSection title="Actividad Reciente">
                {activityLoading ? (
                  <div className="space-y-2.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex items-start gap-2.5 py-2">
                        <Skeleton className="h-2 w-2 rounded-full shrink-0 mt-1.5" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3 w-3/4" />
                          <Skeleton className="h-2.5 w-1/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : userActivity && userActivity.length > 0 ? (
                  userActivity.slice(0, 5).map((item) => (
                    <DrawerActivityItem
                      key={item.id}
                      color={
                        item.type === 'request_created' ? 'bg-info' :
                        item.type === 'status_changed' ? 'bg-warning' :
                        item.type === 'document_uploaded' ? 'bg-primary' :
                        'bg-success'
                      }
                      text={item.description}
                      time={formatRelativeTime(item.createdAt)}
                    />
                  ))
                ) : (
                  <DrawerEmptyState text="Sin actividad registrada" />
                )}
              </DrawerSection>
            </DrawerBody>
            <DrawerFooter>
              <Button
                variant="gold"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setDrawerUser(null)
                  setEditTarget(drawerUser)
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar usuario
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-danger border-danger/30 hover:bg-danger/10"
                onClick={() => {
                  setDrawerUser(null)
                  setToggleTarget(drawerUser)
                }}
              >
                {drawerUser.isActive ? 'Desactivar' : 'Activar'}
              </Button>
            </DrawerFooter>
          </>
        )}
      </DetailDrawer>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={roles ?? []}
        isPending={creating}
        onSubmit={(input) => {
          create(input, {
            onSuccess: () => {
              setCreateOpen(false)
            },
          })
        }}
      />

      {/* Edit User Dialog */}
      {editTarget && (
        <EditUserDialog
          user={editTarget}
          roles={roles ?? []}
          isPending={updating}
          onClose={() => setEditTarget(null)}
          onSubmit={(input) => {
            update({ id: editTarget.id, input }, {
              onSuccess: () => {
                setEditTarget(null)
              },
            })
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <DeleteConfirmationDialog
          open={!!deleteTarget}
          onOpenChange={() => setDeleteTarget(null)}
          title="Eliminar usuario"
          description={`¿Estás seguro de que deseas eliminar a "${deleteTarget.fullName}"? Esta acción no puede deshacerse.`}
          isPending={deleting}
          onConfirm={() => {
            remove(deleteTarget.id, {
              onSuccess: () => {
                setDeleteTarget(null)
              },
            })
          }}
        />
      )}

      {/* Toggle Status Dialog */}
      {toggleTarget && (
        <Dialog open={!!toggleTarget} onOpenChange={() => setToggleTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {toggleTarget.isActive ? 'Desactivar' : 'Activar'} usuario
              </DialogTitle>
              <DialogDescription>
                ¿Deseas {toggleTarget.isActive ? 'desactivar' : 'activar'} a "{toggleTarget.fullName}"?
                {toggleTarget.isActive && ' No podrá iniciar sesión hasta que sea reactivado.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setToggleTarget(null)} className="w-full sm:w-auto h-10 sm:h-9">
                Cancelar
              </Button>
              <Button
                variant={toggleTarget.isActive ? 'destructive' : 'default'}
                size="sm"
                disabled={toggling}
                onClick={() => {
                  toggleStatus(
                    { id: toggleTarget.id, isActive: !toggleTarget.isActive },
                    {
                      onSuccess: () => {
                        setToggleTarget(null)
                      },
                    },
                  )
                }}
                className="w-full sm:w-auto h-10 sm:h-9"
              >
                {toggling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {toggleTarget.isActive ? 'Desactivar' : 'Activar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function CreateUserDialog({
  open,
  onOpenChange,
  roles,
  isPending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: { id: string; name: RoleName }[]
  isPending: boolean
  onSubmit: (input: CreateUserInput) => void
}) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: '',
      email: '',
      documentNumber: '',
      password: '',
      roleId: '',
      program: '',
      semester: undefined,
      studentCode: '',
    },
  })

  const selectedRoleId = useWatch({ control, name: 'roleId' })
  const selectedRole = roles.find((r) => r.id === selectedRoleId)
  const isStudent = selectedRole?.name === 'STUDENT'

  const handleCreate = (data: CreateUserForm) => {
    const input: CreateUserInput = {
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      documentNumber: data.documentNumber,
      roleId: data.roleId,
      program: isStudent ? data.program : undefined,
      semester: isStudent ? data.semester : undefined,
      studentCode: isStudent ? data.studentCode : undefined,
    }
    onSubmit(input)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
          <DialogDescription>
            Completa los datos para crear una cuenta de usuario.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Nombre completo <span className="text-danger" aria-hidden="true">*</span>
              </Label>
              <Input
                id="fullName"
                aria-required="true"
                aria-invalid={errors.fullName ? 'true' : 'false'}
                aria-describedby={errors.fullName ? 'create-fullName-error' : undefined}
                {...register('fullName')}
                className={errors.fullName ? 'border-danger' : ''}
                disabled={isPending}
                autoFocus
              />
              {errors.fullName && (
                <p id="create-fullName-error" className="text-xs text-danger mt-1" role="alert">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Correo <span className="text-danger" aria-hidden="true">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                aria-required="true"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'create-email-error' : undefined}
                {...register('email')}
                className={errors.email ? 'border-danger' : ''}
                disabled={isPending}
              />
              {errors.email && (
                <p id="create-email-error" className="text-xs text-danger mt-1" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="documentNumber">
                Documento <span className="text-danger" aria-hidden="true">*</span>
              </Label>
              <Input
                id="documentNumber"
                aria-required="true"
                aria-invalid={errors.documentNumber ? 'true' : 'false'}
                aria-describedby={errors.documentNumber ? 'create-documentNumber-error' : undefined}
                {...register('documentNumber')}
                className={errors.documentNumber ? 'border-danger' : ''}
                disabled={isPending}
              />
              {errors.documentNumber && (
                <p id="create-documentNumber-error" className="text-xs text-danger mt-1" role="alert">
                  {errors.documentNumber.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Contraseña <span className="text-danger" aria-hidden="true">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                aria-required="true"
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={errors.password ? 'create-password-error' : 'create-password-help'}
                {...register('password')}
                className={errors.password ? 'border-danger' : ''}
                disabled={isPending}
              />
              {errors.password ? (
                <p id="create-password-error" className="text-xs text-danger mt-1" role="alert">
                  {errors.password.message}
                </p>
              ) : (
                <p id="create-password-help" className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres.
                </p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="roleId">
                Rol <span className="text-danger" aria-hidden="true">*</span>
              </Label>
              <Select
                value={selectedRoleId}
                onValueChange={(v) => setValue('roleId', v, { shouldValidate: true })}
                disabled={isPending}
              >
                <SelectTrigger
                  id="roleId"
                  className={`w-full h-10 ${errors.roleId ? 'border-danger' : ''}`}
                  aria-required="true"
                  aria-invalid={errors.roleId ? 'true' : 'false'}
                  aria-describedby={errors.roleId ? 'create-roleId-error' : undefined}
                >
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {ROLE_CONFIG[role.name]?.label ?? role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.roleId && (
                <p id="create-roleId-error" className="text-xs text-danger mt-1" role="alert">
                  {errors.roleId.message}
                </p>
              )}
            </div>
          </div>

          {isStudent && (
            <fieldset className="grid gap-4 sm:grid-cols-3 border-t border-border pt-4">
              <legend className="sr-only">Datos de estudiante</legend>
              <div className="space-y-2">
                <Label htmlFor="program">
                  Programa <span className="text-danger" aria-hidden="true">*</span>
                </Label>
                <Input id="program" aria-required="true" {...register('program')} disabled={isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="semester">
                  Semestre <span className="text-danger" aria-hidden="true">*</span>
                </Label>
                <Input id="semester" type="number" aria-required="true" {...register('semester', { valueAsNumber: true })} disabled={isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="studentCode">
                  Código <span className="text-danger" aria-hidden="true">*</span>
                </Label>
                <Input id="studentCode" aria-required="true" {...register('studentCode')} disabled={isPending} />
              </div>
            </fieldset>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" type="button" onClick={() => { reset(); onOpenChange(false) }} className="w-full sm:w-auto h-10 sm:h-9">
              Cancelar
            </Button>
            <Button size="sm" type="submit" disabled={isPending} className="w-full sm:w-auto h-10 sm:h-9">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Crear usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditUserDialog({
  user,
  roles,
  isPending,
  onClose,
  onSubmit,
}: {
  user: AdminUser
  roles: { id: string; name: RoleName }[]
  isPending: boolean
  onClose: () => void
  onSubmit: (input: {
    email?: string
    fullName?: string
    documentNumber?: string
    roleId?: string
    program?: string
    semester?: number
    studentCode?: string
  }) => void
}) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      fullName: user.fullName,
      email: user.email,
      documentNumber: user.documentNumber,
      roleId: user.roleId,
      program: user.studentProfile?.program ?? '',
      semester: user.studentProfile?.semester ?? undefined,
      studentCode: user.studentProfile?.studentCode ?? '',
    },
  })

  const selectedRoleId = useWatch({ control, name: 'roleId' })
  const selectedRole = roles.find((r) => r.id === selectedRoleId)
  const isStudent = selectedRole?.name === 'STUDENT'

  const handleEdit = (data: EditUserForm) => {
    onSubmit({
      email: data.email,
      fullName: data.fullName,
      documentNumber: data.documentNumber,
      roleId: data.roleId,
      program: isStudent ? data.program : undefined,
      semester: isStudent ? data.semester : undefined,
      studentCode: isStudent ? data.studentCode : undefined,
    })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>
            Modifica los datos de {user.fullName}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleEdit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">
                Nombre completo <span className="text-danger" aria-hidden="true">*</span>
              </Label>
              <Input
                id="edit-fullName"
                aria-required="true"
                aria-invalid={errors.fullName ? 'true' : 'false'}
                aria-describedby={errors.fullName ? 'edit-fullName-error' : undefined}
                {...register('fullName')}
                className={errors.fullName ? 'border-danger' : ''}
                disabled={isPending}
                autoFocus
              />
              {errors.fullName && (
                <p id="edit-fullName-error" className="text-xs text-danger mt-1" role="alert">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">
                Correo <span className="text-danger" aria-hidden="true">*</span>
              </Label>
              <Input
                id="edit-email"
                type="email"
                aria-required="true"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'edit-email-error' : undefined}
                {...register('email')}
                className={errors.email ? 'border-danger' : ''}
                disabled={isPending}
              />
              {errors.email && (
                <p id="edit-email-error" className="text-xs text-danger mt-1" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-documentNumber">
                Documento <span className="text-danger" aria-hidden="true">*</span>
              </Label>
              <Input
                id="edit-documentNumber"
                aria-required="true"
                aria-invalid={errors.documentNumber ? 'true' : 'false'}
                aria-describedby={errors.documentNumber ? 'edit-documentNumber-error' : undefined}
                {...register('documentNumber')}
                className={errors.documentNumber ? 'border-danger' : ''}
                disabled={isPending}
              />
              {errors.documentNumber && (
                <p id="edit-documentNumber-error" className="text-xs text-danger mt-1" role="alert">
                  {errors.documentNumber.message}
                </p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-roleId">
                Rol <span className="text-danger" aria-hidden="true">*</span>
              </Label>
              <Select
                value={selectedRoleId}
                onValueChange={(v) => setValue('roleId', v, { shouldValidate: true })}
                disabled={isPending}
              >
                <SelectTrigger
                  id="edit-roleId"
                  className={`w-full h-10 ${errors.roleId ? 'border-danger' : ''}`}
                  aria-required="true"
                  aria-invalid={errors.roleId ? 'true' : 'false'}
                  aria-describedby={errors.roleId ? 'edit-roleId-error' : undefined}
                >
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {ROLE_CONFIG[role.name]?.label ?? role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.roleId && (
                <p id="edit-roleId-error" className="text-xs text-danger mt-1" role="alert">
                  {errors.roleId.message}
                </p>
              )}
            </div>
          </div>

          {isStudent && (
            <fieldset className="grid gap-4 sm:grid-cols-3 border-t border-border pt-4">
              <legend className="sr-only">Datos de estudiante</legend>
              <div className="space-y-2">
                <Label htmlFor="edit-program">Programa</Label>
                <Input id="edit-program" {...register('program')} disabled={isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-semester">Semestre</Label>
                <Input id="edit-semester" type="number" {...register('semester', { valueAsNumber: true })} disabled={isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-studentCode">Código</Label>
                <Input id="edit-studentCode" {...register('studentCode')} disabled={isPending} />
              </div>
            </fieldset>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" type="button" onClick={onClose} className="w-full sm:w-auto h-10 sm:h-9">
              Cancelar
            </Button>
            <Button size="sm" type="submit" disabled={isPending} className="w-full sm:w-auto h-10 sm:h-9">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `Hace ${minutes} min`
  if (hours < 24) return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  if (days < 30) return `Hace ${days} ${days === 1 ? 'día' : 'días'}`
  return new Date(dateStr).toLocaleDateString('es-CO')
}
