import { RequestStatus, RoleName } from '@prisma/client';
import {
  ALLOWED_TRANSITIONS,
  ADMIN_ALLOWED_TRANSITIONS,
  COORDINATOR_ALLOWED_TRANSITIONS,
  FINAL_STATUSES,
  ROLES_THAT_CAN_CREATE_REQUESTS,
  ROLES_THAT_CAN_DELETE_DOCUMENTS,
  ROLES_THAT_CAN_GENERATE_OFFICIAL_DOCUMENTS,
  ROLES_THAT_CAN_UPLOAD_DOCUMENTS,
  STAFF_ALLOWED_TRANSITIONS,
  STUDENT_UPLOAD_ALLOWED_STATES,
  canActorCreateRequest,
  canActorDeleteDocuments,
  canActorGenerateOfficialDocuments,
  canActorUploadDocuments,
  isFinalStatus,
  isTransitionAllowedByWorkflow,
  isTransitionAllowedForRole,
} from './request-workflow.rules';

describe('request-workflow.rules - Modelo RBAC 4B', () => {
  describe('Estados finales', () => {
    it('APPROVED, REJECTED, CANCELLED son estados finales', () => {
      expect(FINAL_STATUSES).toEqual(['APPROVED', 'REJECTED', 'CANCELLED']);
    });

    it('isFinalStatus detecta los 3 estados finales', () => {
      expect(isFinalStatus('APPROVED')).toBe(true);
      expect(isFinalStatus('REJECTED')).toBe(true);
      expect(isFinalStatus('CANCELLED')).toBe(true);
    });

    it('isFinalStatus retorna false para estados no finales', () => {
      expect(isFinalStatus('DRAFT')).toBe(false);
      expect(isFinalStatus('SUBMITTED')).toBe(false);
      expect(isFinalStatus('IN_REVIEW')).toBe(false);
      expect(isFinalStatus('PENDING_DOCUMENTS')).toBe(false);
    });
  });

  describe('Matriz global de transiciones (ALLOWED_TRANSITIONS)', () => {
    it('DRAFT solo puede ir a SUBMITTED o CANCELLED', () => {
      expect(ALLOWED_TRANSITIONS.DRAFT).toEqual(['SUBMITTED', 'CANCELLED']);
    });

    it('SUBMITTED puede ir a IN_REVIEW, PENDING_DOCUMENTS, CANCELLED', () => {
      expect(ALLOWED_TRANSITIONS.SUBMITTED).toEqual([
        'IN_REVIEW',
        'PENDING_DOCUMENTS',
        'CANCELLED',
      ]);
    });

    it('IN_REVIEW puede ir a APPROVED, REJECTED, PENDING_DOCUMENTS, CANCELLED', () => {
      expect(ALLOWED_TRANSITIONS.IN_REVIEW).toEqual([
        'APPROVED',
        'REJECTED',
        'PENDING_DOCUMENTS',
        'CANCELLED',
      ]);
    });

    it('PENDING_DOCUMENTS puede ir a IN_REVIEW o CANCELLED', () => {
      expect(ALLOWED_TRANSITIONS.PENDING_DOCUMENTS).toEqual([
        'IN_REVIEW',
        'CANCELLED',
      ]);
    });

    it('APPROVED, REJECTED, CANCELLED no tienen transiciones permitidas', () => {
      expect(ALLOWED_TRANSITIONS.APPROVED).toEqual([]);
      expect(ALLOWED_TRANSITIONS.REJECTED).toEqual([]);
      expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
    });

    it('PROHIBIDO: DRAFT -> APPROVED', () => {
      expect(isTransitionAllowedByWorkflow('DRAFT', 'APPROVED')).toBe(false);
    });

    it('PROHIBIDO: DRAFT -> REJECTED', () => {
      expect(isTransitionAllowedByWorkflow('DRAFT', 'REJECTED')).toBe(false);
    });

    it('PROHIBIDO: SUBMITTED -> APPROVED', () => {
      expect(isTransitionAllowedByWorkflow('SUBMITTED', 'APPROVED')).toBe(
        false,
      );
    });

    it('PROHIBIDO: SUBMITTED -> REJECTED', () => {
      expect(isTransitionAllowedByWorkflow('SUBMITTED', 'REJECTED')).toBe(
        false,
      );
    });

    it('PROHIBIDO: APPROVED -> cualquier estado', () => {
      const targets: RequestStatus[] = [
        'DRAFT',
        'SUBMITTED',
        'IN_REVIEW',
        'PENDING_DOCUMENTS',
        'REJECTED',
        'CANCELLED',
      ];
      for (const to of targets) {
        expect(isTransitionAllowedByWorkflow('APPROVED', to)).toBe(false);
      }
    });

    it('PROHIBIDO: REJECTED -> cualquier estado', () => {
      const targets: RequestStatus[] = [
        'DRAFT',
        'SUBMITTED',
        'IN_REVIEW',
        'PENDING_DOCUMENTS',
        'APPROVED',
        'CANCELLED',
      ];
      for (const to of targets) {
        expect(isTransitionAllowedByWorkflow('REJECTED', to)).toBe(false);
      }
    });

    it('PROHIBIDO: CANCELLED -> cualquier estado', () => {
      const targets: RequestStatus[] = [
        'DRAFT',
        'SUBMITTED',
        'IN_REVIEW',
        'PENDING_DOCUMENTS',
        'APPROVED',
        'REJECTED',
      ];
      for (const to of targets) {
        expect(isTransitionAllowedByWorkflow('CANCELLED', to)).toBe(false);
      }
    });
  });

  describe('Permisos de creación de solicitudes', () => {
    it('STUDENT puede crear', () => {
      expect(canActorCreateRequest('STUDENT')).toBe(true);
    });

    it('ADMIN puede crear', () => {
      expect(canActorCreateRequest('ADMIN')).toBe(true);
    });

    it('STAFF NO puede crear', () => {
      expect(canActorCreateRequest('STAFF')).toBe(false);
    });

    it('COORDINATOR NO puede crear', () => {
      expect(canActorCreateRequest('COORDINATOR')).toBe(false);
    });

    it('Whitelist oficial: solo STUDENT y ADMIN', () => {
      expect(ROLES_THAT_CAN_CREATE_REQUESTS).toEqual(['STUDENT', 'ADMIN']);
    });
  });

  describe('Permisos de upload de documentos', () => {
    it('STUDENT puede subir', () => {
      expect(canActorUploadDocuments('STUDENT')).toBe(true);
    });

    it('ADMIN puede subir', () => {
      expect(canActorUploadDocuments('ADMIN')).toBe(true);
    });

    it('STAFF NO puede subir', () => {
      expect(canActorUploadDocuments('STAFF')).toBe(false);
    });

    it('COORDINATOR NO puede subir', () => {
      expect(canActorUploadDocuments('COORDINATOR')).toBe(false);
    });

    it('Whitelist oficial: solo STUDENT y ADMIN', () => {
      expect(ROLES_THAT_CAN_UPLOAD_DOCUMENTS).toEqual(['STUDENT', 'ADMIN']);
    });

    it('STUDENT solo puede subir en DRAFT o PENDING_DOCUMENTS', () => {
      expect(STUDENT_UPLOAD_ALLOWED_STATES).toEqual([
        'DRAFT',
        'PENDING_DOCUMENTS',
      ]);
    });
  });

  describe('Permisos de eliminación de documentos', () => {
    it('STUDENT puede eliminar', () => {
      expect(canActorDeleteDocuments('STUDENT')).toBe(true);
    });

    it('ADMIN puede eliminar', () => {
      expect(canActorDeleteDocuments('ADMIN')).toBe(true);
    });

    it('STAFF NO puede eliminar', () => {
      expect(canActorDeleteDocuments('STAFF')).toBe(false);
    });

    it('COORDINATOR NO puede eliminar', () => {
      expect(canActorDeleteDocuments('COORDINATOR')).toBe(false);
    });

    it('Whitelist oficial: solo STUDENT y ADMIN', () => {
      expect(ROLES_THAT_CAN_DELETE_DOCUMENTS).toEqual(['STUDENT', 'ADMIN']);
    });
  });

  describe('Permisos de generación de documentos oficiales', () => {
    it('COORDINATOR puede generar', () => {
      expect(canActorGenerateOfficialDocuments('COORDINATOR')).toBe(true);
    });

    it('ADMIN puede generar', () => {
      expect(canActorGenerateOfficialDocuments('ADMIN')).toBe(true);
    });

    it('STAFF NO puede generar documentos oficiales finales', () => {
      expect(canActorGenerateOfficialDocuments('STAFF')).toBe(false);
    });

    it('STUDENT NO puede generar', () => {
      expect(canActorGenerateOfficialDocuments('STUDENT')).toBe(false);
    });

    it('Whitelist oficial: solo COORDINATOR y ADMIN', () => {
      expect(ROLES_THAT_CAN_GENERATE_OFFICIAL_DOCUMENTS).toEqual([
        'COORDINATOR',
        'ADMIN',
      ]);
    });
  });

  describe('Matriz de transiciones por rol - STAFF', () => {
    it('STAFF no puede transicionar desde DRAFT', () => {
      expect(STAFF_ALLOWED_TRANSITIONS.DRAFT).toEqual([]);
    });

    it('STAFF puede: SUBMITTED -> IN_REVIEW', () => {
      expect(
        isTransitionAllowedForRole('SUBMITTED', 'IN_REVIEW', 'STAFF'),
      ).toBe(true);
    });

    it('STAFF puede: SUBMITTED -> PENDING_DOCUMENTS', () => {
      expect(
        isTransitionAllowedForRole('SUBMITTED', 'PENDING_DOCUMENTS', 'STAFF'),
      ).toBe(true);
    });

    it('STAFF puede: IN_REVIEW -> PENDING_DOCUMENTS', () => {
      expect(
        isTransitionAllowedForRole('IN_REVIEW', 'PENDING_DOCUMENTS', 'STAFF'),
      ).toBe(true);
    });

    it('STAFF puede: PENDING_DOCUMENTS -> IN_REVIEW', () => {
      expect(
        isTransitionAllowedForRole('PENDING_DOCUMENTS', 'IN_REVIEW', 'STAFF'),
      ).toBe(true);
    });

    it('STAFF NO puede aprobar', () => {
      expect(isTransitionAllowedForRole('IN_REVIEW', 'APPROVED', 'STAFF')).toBe(
        false,
      );
    });

    it('STAFF NO puede rechazar', () => {
      expect(isTransitionAllowedForRole('IN_REVIEW', 'REJECTED', 'STAFF')).toBe(
        false,
      );
    });
  });

  describe('Matriz de transiciones por rol - COORDINATOR', () => {
    it('COORDINATOR no puede transicionar desde DRAFT', () => {
      expect(COORDINATOR_ALLOWED_TRANSITIONS.DRAFT).toEqual([]);
    });

    it('COORDINATOR no puede transicionar desde SUBMITTED', () => {
      expect(COORDINATOR_ALLOWED_TRANSITIONS.SUBMITTED).toEqual([]);
    });

    it('COORDINATOR no puede transicionar desde PENDING_DOCUMENTS', () => {
      expect(COORDINATOR_ALLOWED_TRANSITIONS.PENDING_DOCUMENTS).toEqual([]);
    });

    it('COORDINATOR puede: IN_REVIEW -> APPROVED', () => {
      expect(
        isTransitionAllowedForRole('IN_REVIEW', 'APPROVED', 'COORDINATOR'),
      ).toBe(true);
    });

    it('COORDINATOR puede: IN_REVIEW -> REJECTED', () => {
      expect(
        isTransitionAllowedForRole('IN_REVIEW', 'REJECTED', 'COORDINATOR'),
      ).toBe(true);
    });

    it('COORDINATOR NO puede solicitar documentos (IN_REVIEW -> PENDING_DOCUMENTS)', () => {
      expect(
        isTransitionAllowedForRole(
          'IN_REVIEW',
          'PENDING_DOCUMENTS',
          'COORDINATOR',
        ),
      ).toBe(false);
    });
  });

  describe('Matriz de transiciones por rol - ADMIN', () => {
    it('ADMIN puede ejecutar todas las acciones operativas de STAFF', () => {
      expect(
        isTransitionAllowedForRole('SUBMITTED', 'IN_REVIEW', 'ADMIN'),
      ).toBe(true);
      expect(
        isTransitionAllowedForRole('SUBMITTED', 'PENDING_DOCUMENTS', 'ADMIN'),
      ).toBe(true);
      expect(
        isTransitionAllowedForRole('IN_REVIEW', 'PENDING_DOCUMENTS', 'ADMIN'),
      ).toBe(true);
      expect(
        isTransitionAllowedForRole('PENDING_DOCUMENTS', 'IN_REVIEW', 'ADMIN'),
      ).toBe(true);
    });

    it('ADMIN puede ejecutar todas las acciones decisoras de COORDINATOR', () => {
      expect(isTransitionAllowedForRole('IN_REVIEW', 'APPROVED', 'ADMIN')).toBe(
        true,
      );
      expect(isTransitionAllowedForRole('IN_REVIEW', 'REJECTED', 'ADMIN')).toBe(
        true,
      );
    });

    it('ADMIN NO puede saltarse el workflow (DRAFT -> APPROVED)', () => {
      expect(isTransitionAllowedForRole('DRAFT', 'APPROVED', 'ADMIN')).toBe(
        false,
      );
    });

    it('ADMIN NO puede saltarse el workflow (DRAFT -> REJECTED)', () => {
      expect(isTransitionAllowedForRole('DRAFT', 'REJECTED', 'ADMIN')).toBe(
        false,
      );
    });

    it('ADMIN NO puede saltarse el workflow (SUBMITTED -> APPROVED)', () => {
      expect(isTransitionAllowedForRole('SUBMITTED', 'APPROVED', 'ADMIN')).toBe(
        false,
      );
    });

    it('ADMIN NO puede saltarse el workflow (SUBMITTED -> REJECTED)', () => {
      expect(isTransitionAllowedForRole('SUBMITTED', 'REJECTED', 'ADMIN')).toBe(
        false,
      );
    });

    it('ADMIN no puede salir de un estado final', () => {
      const targets: RequestStatus[] = [
        'DRAFT',
        'SUBMITTED',
        'IN_REVIEW',
        'PENDING_DOCUMENTS',
        'CANCELLED',
      ];
      for (const to of targets) {
        expect(isTransitionAllowedForRole('APPROVED', to, 'ADMIN')).toBe(false);
      }
    });

    it('ADMIN_ALLOWED_TRANSITIONS solo permite transiciones validas', () => {
      expect(ADMIN_ALLOWED_TRANSITIONS.DRAFT).toEqual([]);
      expect(ADMIN_ALLOWED_TRANSITIONS.APPROVED).toEqual([]);
      expect(ADMIN_ALLOWED_TRANSITIONS.REJECTED).toEqual([]);
      expect(ADMIN_ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
    });
  });

  describe('Validacion global: isTransitionAllowedForRole respeta isTransitionAllowedByWorkflow', () => {
    it('Una transicion prohibida por workflow es prohibida para todos los roles', () => {
      const roles: RoleName[] = ['STUDENT', 'STAFF', 'COORDINATOR', 'ADMIN'];
      for (const role of roles) {
        if (role === 'STUDENT') {
          expect(isTransitionAllowedForRole('DRAFT', 'APPROVED', role)).toBe(
            false,
          );
          continue;
        }
        expect(isTransitionAllowedForRole('DRAFT', 'APPROVED', role)).toBe(
          false,
        );
        expect(isTransitionAllowedForRole('SUBMITTED', 'APPROVED', role)).toBe(
          false,
        );
      }
    });
  });
});
