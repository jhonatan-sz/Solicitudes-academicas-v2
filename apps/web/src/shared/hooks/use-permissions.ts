import { useAuth } from '@/app/providers/auth-context'
import type { RequestStatus, RoleName } from '@/shared/types'

/**
 * Modelo RBAC 4B - Hook de permisos del frontend.
 *
 * Mantiene la logica espejada del backend para que la UI muestre solo
 * las acciones que el usuario puede ejecutar.
 *
 * La UI es un guiador de UX, NO una segunda barrera de seguridad.
 * El backend siempre valida el modelo 4B independientemente.
 */

const REVIEWER_ROLES: RoleName[] = ['STAFF', 'COORDINATOR', 'ADMIN']

const FINAL_STATUSES: RequestStatus[] = [
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]

const STUDENT_UPLOAD_ALLOWED_STATES: RequestStatus[] = [
  'DRAFT',
  'PENDING_DOCUMENTS',
]

const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['IN_REVIEW', 'PENDING_DOCUMENTS', 'CANCELLED'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'PENDING_DOCUMENTS', 'CANCELLED'],
  PENDING_DOCUMENTS: ['IN_REVIEW', 'CANCELLED'],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
}

const STAFF_ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: [],
  SUBMITTED: ['IN_REVIEW', 'PENDING_DOCUMENTS'],
  IN_REVIEW: ['PENDING_DOCUMENTS'],
  PENDING_DOCUMENTS: ['IN_REVIEW'],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
}

const COORDINATOR_ALLOWED_TRANSITIONS: Record<
  RequestStatus,
  RequestStatus[]
> = {
  DRAFT: [],
  SUBMITTED: [],
  IN_REVIEW: ['APPROVED', 'REJECTED'],
  PENDING_DOCUMENTS: [],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
}

const ADMIN_ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: [],
  SUBMITTED: ['IN_REVIEW', 'PENDING_DOCUMENTS'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'PENDING_DOCUMENTS'],
  PENDING_DOCUMENTS: ['IN_REVIEW'],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
}

function isFinalStatusClient(status: RequestStatus): boolean {
  return FINAL_STATUSES.includes(status)
}

export function usePermissions() {
  const { user } = useAuth()
  const role = user?.role

  const isReviewer = role ? REVIEWER_ROLES.includes(role) : false

  return {
    role,
    isReviewer,
    isStudent: role === 'STUDENT',
    isStaff: role === 'STAFF',
    isCoordinator: role === 'COORDINATOR',
    isAdmin: role === 'ADMIN',

    // Crear solicitud: solo STUDENT y ADMIN
    canCreateRequest: () => role === 'STUDENT' || role === 'ADMIN',

    // Subir documentos: solo STUDENT y ADMIN
    canUploadDocument: () => role === 'STUDENT' || role === 'ADMIN',

    // Eliminar documentos: solo STUDENT (sobre propios) y ADMIN
    canDeleteDocument: () => role === 'STUDENT' || role === 'ADMIN',

    // Generar documentos oficiales: solo COORDINATOR y ADMIN
    canGenerateOfficialDocument: () =>
      role === 'COORDINATOR' || role === 'ADMIN',

    // Aprobar: solo COORDINATOR y ADMIN
    canApprove: () => role === 'COORDINATOR' || role === 'ADMIN',

    // Rechazar: solo COORDINATOR y ADMIN
    canReject: () => role === 'COORDINATOR' || role === 'ADMIN',

    // Solicitar documentos: solo STAFF y ADMIN
    canRequestDocuments: () => role === 'STAFF' || role === 'ADMIN',

    canReview: () => isReviewer,

    canChangeStatus: (currentStatus: RequestStatus) => {
      if (!role || !isReviewer) return false
      if (isFinalStatusClient(currentStatus)) return false

      if (role === 'STAFF') {
        if (currentStatus === 'SUBMITTED') return true
        if (currentStatus === 'IN_REVIEW') return true
        if (currentStatus === 'PENDING_DOCUMENTS') return true
        return false
      }
      if (role === 'COORDINATOR') {
        return currentStatus === 'IN_REVIEW'
      }
      if (role === 'ADMIN') {
        return currentStatus !== 'DRAFT' && currentStatus !== 'CANCELLED'
          ? currentStatus === 'SUBMITTED' ||
              currentStatus === 'IN_REVIEW' ||
              currentStatus === 'PENDING_DOCUMENTS'
          : false
      }
      return false
    },

    getAvailableActions: (
      currentStatus: RequestStatus,
    ): RequestStatus[] => {
      if (!role || !isReviewer) return []
      if (isFinalStatusClient(currentStatus)) return []
      if (!ALLOWED_TRANSITIONS[currentStatus]) return []

      const candidates = ALLOWED_TRANSITIONS[currentStatus].filter(
        (t) => t !== 'CANCELLED',
      )
      if (role === 'STAFF') {
        return candidates.filter((t) =>
          STAFF_ALLOWED_TRANSITIONS[currentStatus]?.includes(t),
        )
      }
      if (role === 'COORDINATOR') {
        return candidates.filter((t) =>
          COORDINATOR_ALLOWED_TRANSITIONS[currentStatus]?.includes(t),
        )
      }
      if (role === 'ADMIN') {
        return candidates.filter((t) =>
          ADMIN_ALLOWED_TRANSITIONS[currentStatus]?.includes(t),
        )
      }
      return []
    },

    // Helpers para el contexto del solicitante
    isRequestOwner: (requestUserId: string) =>
      !!user && user.id === requestUserId,

    // Puede editar metadata (titulo/descripcion)
    canEditRequest: (
      requestUserId: string,
      currentStatus: RequestStatus,
    ) => {
      if (!role) return false
      if (isFinalStatusClient(currentStatus)) return false
      if (role === 'ADMIN') return true
      if (role === 'STUDENT') {
        return user?.id === requestUserId && currentStatus === 'DRAFT'
      }
      return false
    },

    // Puede enviar (submit) una solicitud en DRAFT
    canSubmitRequest: (requestUserId: string, currentStatus: RequestStatus) => {
      if (!role) return false
      if (isFinalStatusClient(currentStatus)) return false
      if (currentStatus !== 'DRAFT') return false
      if (role === 'ADMIN') return true
      if (role === 'STUDENT') return user?.id === requestUserId
      return false
    },

    // Puede cancelar
    canCancelRequest: (
      requestUserId: string,
      currentStatus: RequestStatus,
    ) => {
      if (!role) return false
      if (isFinalStatusClient(currentStatus)) return false
      if (role === 'ADMIN') return true
      if (role === 'STUDENT') return user?.id === requestUserId
      return false
    },

    // Puede subir adjunto a esta solicitud
    canUploadToRequest: (
      requestUserId: string,
      currentStatus: RequestStatus,
    ) => {
      if (!role) return false
      if (role !== 'STUDENT' && role !== 'ADMIN') return false
      if (isFinalStatusClient(currentStatus)) return false
      if (role === 'STUDENT') {
        return (
          user?.id === requestUserId &&
          STUDENT_UPLOAD_ALLOWED_STATES.includes(currentStatus)
        )
      }
      return true
    },

    // Puede eliminar un adjunto especifico
    canDeleteAttachment: (
      attachmentUploadedBy: string,
      requestUserId: string,
      currentStatus: RequestStatus,
    ) => {
      if (!role) return false
      if (role !== 'STUDENT' && role !== 'ADMIN') return false
      if (isFinalStatusClient(currentStatus)) return false
      if (role === 'ADMIN') return true
      if (role === 'STUDENT') {
        return (
          user?.id === requestUserId && user.id === attachmentUploadedBy
        )
      }
      return false
    },
  }
}
