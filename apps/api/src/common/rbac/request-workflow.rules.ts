import { RequestStatus, RoleName } from '@prisma/client';

/**
 * Modelo RBAC 4B - Matriz centralizada de transiciones de estado permitidas.
 *
 * Reglas oficiales:
 * - DRAFT -> SUBMITTED -> IN_REVIEW -> APPROVED | REJECTED
 * - DRAFT -> SUBMITTED -> IN_REVIEW -> PENDING_DOCUMENTS -> IN_REVIEW
 * - Cualquier estado no final -> CANCELLED (solo owner o ADMIN)
 * - APPROVED, REJECTED, CANCELLED son INMUTABLES
 *
 * Roles:
 * - STUDENT: solo owner puede submit/cancel propios.
 * - STAFF: SUBMITTED -> IN_REVIEW, IN_REVIEW <-> PENDING_DOCUMENTS.
 * - COORDINATOR: IN_REVIEW -> APPROVED | REJECTED. Genera docs oficiales.
 * - ADMIN: todas las acciones operativas (STAFF + COORDINATOR) PERO respetando workflow.
 *
 * ADMIN NO puede saltarse el workflow.
 */

export const FINAL_STATUSES: RequestStatus[] = [
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];

export const ROLES_THAT_CAN_CREATE_REQUESTS: RoleName[] = ['STUDENT', 'ADMIN'];

export const ROLES_THAT_CAN_UPLOAD_DOCUMENTS: RoleName[] = ['STUDENT', 'ADMIN'];

export const ROLES_THAT_CAN_DELETE_DOCUMENTS: RoleName[] = ['STUDENT', 'ADMIN'];

export const ROLES_THAT_CAN_GENERATE_OFFICIAL_DOCUMENTS: RoleName[] = [
  'COORDINATOR',
  'ADMIN',
];

export const ROLES_THAT_CAN_VIEW_ALL_REQUESTS: RoleName[] = [
  'STAFF',
  'COORDINATOR',
  'ADMIN',
];

export const ROLES_THAT_CAN_VIEW_ACADEMIC_STATS: RoleName[] = [
  'STAFF',
  'COORDINATOR',
  'ADMIN',
];

/**
 * Transiciones de estado permitidas por la lógica de negocio (sin importar rol).
 * Esta es la matriz GLOBAL del workflow institucional.
 */
export const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['IN_REVIEW', 'PENDING_DOCUMENTS', 'CANCELLED'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'PENDING_DOCUMENTS', 'CANCELLED'],
  PENDING_DOCUMENTS: ['IN_REVIEW', 'CANCELLED'],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
};

/**
 * Transiciones permitidas para STAFF.
 * STAFF no aprueba, no rechaza, no crea, no genera docs.
 * Solo opera el flujo de revisión documental.
 */
export const STAFF_ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> =
  {
    DRAFT: [],
    SUBMITTED: ['IN_REVIEW', 'PENDING_DOCUMENTS'],
    IN_REVIEW: ['PENDING_DOCUMENTS'],
    PENDING_DOCUMENTS: ['IN_REVIEW'],
    APPROVED: [],
    REJECTED: [],
    CANCELLED: [],
  };

/**
 * Transiciones permitidas para COORDINATOR.
 * COORDINATOR es el decisor académico.
 * NO es operativo: no solicita documentos, no transiciona a PENDING_DOCS.
 */
export const COORDINATOR_ALLOWED_TRANSITIONS: Record<
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
};

/**
 * Transiciones permitidas para ADMIN.
 * ADMIN puede ejecutar todas las acciones operativas (STAFF + COORDINATOR).
 * ADMIN NO puede saltarse el workflow.
 * ADMIN NO tiene una matriz permisiva propia; debe pasar por las validaciones
 * de las matrices por rol de acuerdo a la accion que ejecuta.
 *
 * Si ADMIN esta transicionando como STAFF -> usa STAFF_ALLOWED_TRANSITIONS.
 * Si ADMIN esta transicionando como COORDINATOR -> usa COORDINATOR_ALLOWED_TRANSITIONS.
 *
 * Para la validacion central, se calcula la union de matrices de STAFF + COORDINATOR.
 */
export const ADMIN_ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> =
  {
    DRAFT: [],
    SUBMITTED: ['IN_REVIEW', 'PENDING_DOCUMENTS'],
    IN_REVIEW: ['APPROVED', 'REJECTED', 'PENDING_DOCUMENTS'],
    PENDING_DOCUMENTS: ['IN_REVIEW'],
    APPROVED: [],
    REJECTED: [],
    CANCELLED: [],
  };

/**
 * Estados en los que NO se permite subir documentos.
 * Para STUDENT: solo DRAFT y PENDING_DOCUMENTS.
 * Para ADMIN: cualquier estado NO final.
 */
export const STUDENT_UPLOAD_ALLOWED_STATES: RequestStatus[] = [
  'DRAFT',
  'PENDING_DOCUMENTS',
];

/**
 * Estados en los que NO se permite ninguna modificacion.
 * Documentos en estados finales son inmutables.
 */
export const IMMUTABLE_STATUSES: RequestStatus[] = [
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];

/**
 * Mensajes de error estandarizados para el modelo RBAC 4B.
 */
export const RBAC_ERROR_MESSAGES = {
  CANNOT_CREATE_REQUEST:
    'No tienes permisos para crear solicitudes. Solo estudiantes y administradores pueden hacerlo.',
  CANNOT_CREATE_FOR_TARGET_ROLE:
    'El administrador solo puede crear solicitudes para estudiantes activos.',
  CANNOT_VIEW_OTHER_REQUESTS: 'Solo puedes ver tus propias solicitudes.',
  CANNOT_EDIT_OTHER_REQUESTS: 'Solo puedes editar tus propias solicitudes.',
  CANNOT_EDIT_NON_DRAFT:
    'Solo se pueden editar solicitudes en estado borrador.',
  CANNOT_SUBMIT_OTHER_REQUESTS: 'Solo puedes enviar tus propias solicitudes.',
  CANNOT_SUBMIT_NON_DRAFT:
    'Solo se pueden enviar solicitudes en estado borrador.',
  CANNOT_CANCEL_OTHER_REQUESTS: 'Solo puedes cancelar tus propias solicitudes.',
  CANNOT_CANCEL_FINAL: 'No se puede cancelar una solicitud en estado final.',
  REQUEST_IN_FINAL_STATE: (status: string) =>
    `La solicitud ya se encuentra en estado final '${status}'. Los estados finales son inmutables.`,
  REQUEST_ALREADY_IN_STATE: (status: string) =>
    `La solicitud ya se encuentra en estado '${status}'.`,
  INVALID_TRANSITION: (from: string, to: string) =>
    `Transición no permitida: ${from} -> ${to}. El workflow institucional no permite este cambio.`,
  REJECTION_REQUIRES_COMMENT:
    'Se requiere un motivo al rechazar una solicitud (mínimo 10 caracteres).',
  STAFF_CANNOT_APPROVE: 'El funcionario no puede aprobar solicitudes.',
  STAFF_CANNOT_REJECT: 'El funcionario no puede rechazar solicitudes.',
  STAFF_CANNOT_GENERATE_OFFICIAL:
    'El funcionario no puede generar documentos oficiales finales.',
  COORDINATOR_CANNOT_REQUEST_DOCS:
    'El coordinador no puede solicitar documentos adicionales. Solo el funcionario de registro puede hacerlo.',
  COORDINATOR_CANNOT_UPLOAD: 'El coordinador no puede subir documentos.',
  COORDINATOR_CANNOT_DELETE: 'El coordinador no puede eliminar documentos.',
  STAFF_CANNOT_UPLOAD: 'El funcionario no puede subir documentos.',
  STAFF_CANNOT_DELETE: 'El funcionario no puede eliminar documentos.',
  CANNOT_UPLOAD_IN_FINAL_STATE: (status: string) =>
    `No se pueden subir documentos a solicitudes en estado final '${status}'.`,
  CANNOT_DELETE_IN_FINAL_STATE: (status: string) =>
    `No se pueden eliminar documentos de solicitudes en estado final '${status}'.`,
  CANNOT_UPLOAD_OTHER_REQUESTS:
    'Solo puedes subir documentos a tus propias solicitudes.',
  CANNOT_DELETE_OTHER_USERS_DOCUMENTS:
    'Solo puedes eliminar documentos que tu subiste a tus propias solicitudes.',
  CANNOT_GENERATE_DOCS_NON_APPROVED:
    'Solo se pueden generar documentos oficiales para solicitudes aprobadas.',
  CANNOT_GENERATE_DOCS_MISSING_PROFILE:
    'El estudiante no tiene perfil academico registrado.',
};

/**
 * Helpers puros para validar el modelo RBAC 4B.
 * Mantener estos helpers sin dependencias para que sean facilmente testeables.
 */

export function isFinalStatus(status: RequestStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

export function canActorCreateRequest(role: RoleName): boolean {
  return ROLES_THAT_CAN_CREATE_REQUESTS.includes(role);
}

export function canActorUploadDocuments(role: RoleName): boolean {
  return ROLES_THAT_CAN_UPLOAD_DOCUMENTS.includes(role);
}

export function canActorDeleteDocuments(role: RoleName): boolean {
  return ROLES_THAT_CAN_DELETE_DOCUMENTS.includes(role);
}

export function canActorGenerateOfficialDocuments(role: RoleName): boolean {
  return ROLES_THAT_CAN_GENERATE_OFFICIAL_DOCUMENTS.includes(role);
}

export function isTransitionAllowedByWorkflow(
  from: RequestStatus,
  to: RequestStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTransitionAllowedForRole(
  from: RequestStatus,
  to: RequestStatus,
  role: RoleName,
): boolean {
  if (role === 'STUDENT') return false;
  if (role === 'STAFF') {
    return STAFF_ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }
  if (role === 'COORDINATOR') {
    return COORDINATOR_ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }
  if (role === 'ADMIN') {
    return ADMIN_ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }
  return false;
}
