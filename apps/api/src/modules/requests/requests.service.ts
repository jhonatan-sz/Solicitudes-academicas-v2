import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { CreateRequestTypeDto } from './dto/create-request-type.dto';
import { UpdateRequestTypeDto } from './dto/update-request-type.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { QueryRequestsDto } from './dto/query-requests.dto';
import { RequestStatus, RoleName } from '@prisma/client';
import { randomBytes } from 'crypto';
import {
  RBAC_ERROR_MESSAGES,
  isFinalStatus,
  isTransitionAllowedByWorkflow,
  isTransitionAllowedForRole,
  canActorCreateRequest,
} from '../../common/rbac/request-workflow.rules';

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(actorId: string, actorRole: RoleName, dto: CreateRequestDto) {
    if (!canActorCreateRequest(actorRole)) {
      throw new ForbiddenException(RBAC_ERROR_MESSAGES.CANNOT_CREATE_REQUEST);
    }

    let userId: string;

    if (actorRole === 'STUDENT') {
      if (dto.userId && dto.userId !== actorId) {
        throw new ForbiddenException(
          RBAC_ERROR_MESSAGES.CANNOT_CREATE_FOR_TARGET_ROLE,
        );
      }
      userId = actorId;
    } else {
      if (!dto.userId) {
        throw new BadRequestException(
          'El administrador debe especificar el userId del estudiante para quien crea la solicitud.',
        );
      }

      const target = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        select: {
          id: true,
          isActive: true,
          role: { select: { name: true } },
        },
      });

      if (!target || !target.isActive) {
        throw new BadRequestException(
          'El usuario objetivo no existe o esta inactivo.',
        );
      }

      if (target.role.name !== 'STUDENT') {
        throw new ForbiddenException(
          RBAC_ERROR_MESSAGES.CANNOT_CREATE_FOR_TARGET_ROLE,
        );
      }

      userId = dto.userId;
    }

    const requestType = await this.prisma.requestType.findUnique({
      where: { id: dto.requestTypeId },
    });

    if (!requestType || !requestType.isActive) {
      throw new NotFoundException('Tipo de solicitud no encontrado o inactivo');
    }

    const trackingNumber = this.generateTrackingNumber();

    const request = await this.prisma.request.create({
      data: {
        trackingNumber,
        title: dto.title,
        description: dto.description,
        status: 'DRAFT',
        userId,
        requestTypeId: dto.requestTypeId,
      },
      include: {
        requestType: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
    });

    return request;
  }

  async findAll(userId: string, role: RoleName, query: QueryRequestsDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (role === 'STUDENT') {
      where.userId = userId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.requestTypeId) {
      where.requestTypeId = query.requestTypeId;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requestType: { select: { id: true, name: true } },
          user: { select: { id: true, fullName: true, email: true } },
          _count: { select: { attachments: true, history: true } },
        },
      }),
      this.prisma.request.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId: string, role: RoleName) {
    const request = await this.prisma.request.findUnique({
      where: { id },
      include: {
        requestType: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            documentNumber: true,
            studentProfile: {
              select: {
                program: true,
                semester: true,
                studentCode: true,
              },
            },
          },
        },
        attachments: { orderBy: { createdAt: 'desc' } },
        history: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, fullName: true } } },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (role === 'STUDENT' && request.userId !== userId) {
      throw new ForbiddenException('Solo puedes ver tus propias solicitudes');
    }

    return request;
  }

  async update(
    id: string,
    actorId: string,
    actorRole: RoleName,
    dto: UpdateRequestDto,
  ) {
    const request = await this.prisma.request.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (isFinalStatus(request.status)) {
      throw new ForbiddenException(
        RBAC_ERROR_MESSAGES.REQUEST_IN_FINAL_STATE(request.status),
      );
    }

    if (actorRole !== 'ADMIN' && request.userId !== actorId) {
      throw new ForbiddenException(
        RBAC_ERROR_MESSAGES.CANNOT_EDIT_OTHER_REQUESTS,
      );
    }

    if (actorRole === 'STUDENT' && request.status !== 'DRAFT') {
      throw new ForbiddenException(RBAC_ERROR_MESSAGES.CANNOT_EDIT_NON_DRAFT);
    }

    return this.prisma.request.update({
      where: { id },
      data: { ...dto },
      include: {
        requestType: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async submit(id: string, actorId: string, actorRole: RoleName) {
    const request = await this.prisma.request.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (isFinalStatus(request.status)) {
      throw new ForbiddenException(
        RBAC_ERROR_MESSAGES.REQUEST_IN_FINAL_STATE(request.status),
      );
    }

    if (actorRole !== 'ADMIN' && request.userId !== actorId) {
      throw new ForbiddenException(
        RBAC_ERROR_MESSAGES.CANNOT_SUBMIT_OTHER_REQUESTS,
      );
    }

    if (request.status !== 'DRAFT') {
      throw new ConflictException(RBAC_ERROR_MESSAGES.CANNOT_SUBMIT_NON_DRAFT);
    }

    return this.changeStatusInternal(
      id,
      'SUBMITTED',
      request.status,
      actorId,
      null,
    );
  }

  async cancel(id: string, actorId: string, actorRole: RoleName) {
    const request = await this.prisma.request.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (isFinalStatus(request.status)) {
      throw new ForbiddenException(RBAC_ERROR_MESSAGES.CANNOT_CANCEL_FINAL);
    }

    if (actorRole !== 'ADMIN' && request.userId !== actorId) {
      throw new ForbiddenException(
        RBAC_ERROR_MESSAGES.CANNOT_CANCEL_OTHER_REQUESTS,
      );
    }

    return this.changeStatusInternal(
      id,
      'CANCELLED',
      request.status,
      actorId,
      'Cancelled by user',
    );
  }

  async changeStatus(
    id: string,
    dto: ChangeStatusDto,
    actorId: string,
    actorRole: RoleName,
  ) {
    const request = await this.prisma.request.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (isFinalStatus(request.status)) {
      throw new ForbiddenException(
        RBAC_ERROR_MESSAGES.REQUEST_IN_FINAL_STATE(request.status),
      );
    }

    if (request.status === dto.newStatus) {
      throw new ConflictException(
        RBAC_ERROR_MESSAGES.REQUEST_ALREADY_IN_STATE(dto.newStatus),
      );
    }

    if (actorRole === 'STUDENT') {
      throw new ForbiddenException(
        'Los estudiantes no pueden cambiar el estado de las solicitudes.',
      );
    }

    if (!isTransitionAllowedByWorkflow(request.status, dto.newStatus)) {
      throw new BadRequestException(
        RBAC_ERROR_MESSAGES.INVALID_TRANSITION(request.status, dto.newStatus),
      );
    }

    if (!isTransitionAllowedForRole(request.status, dto.newStatus, actorRole)) {
      throw new ForbiddenException(
        this.buildRoleTransitionError(actorRole, request.status, dto.newStatus),
      );
    }

    if (dto.newStatus === 'REJECTED' && !dto.comment?.trim()) {
      throw new BadRequestException(
        RBAC_ERROR_MESSAGES.REJECTION_REQUIRES_COMMENT,
      );
    }

    return this.changeStatusInternal(
      id,
      dto.newStatus,
      request.status,
      actorId,
      dto.comment?.trim() ?? null,
    );
  }

  private buildRoleTransitionError(
    actorRole: RoleName,
    from: RequestStatus,
    to: RequestStatus,
  ): string {
    if (actorRole === 'STAFF') {
      if (to === 'APPROVED' || to === 'REJECTED') {
        return RBAC_ERROR_MESSAGES.STAFF_CANNOT_APPROVE;
      }
      return `El funcionario no puede transicionar de ${from} a ${to}. Solo puede operar el flujo de revision documental.`;
    }
    if (actorRole === 'COORDINATOR') {
      if (to === 'PENDING_DOCUMENTS') {
        return RBAC_ERROR_MESSAGES.COORDINATOR_CANNOT_REQUEST_DOCS;
      }
      if (from !== 'IN_REVIEW' && (to === 'APPROVED' || to === 'REJECTED')) {
        return `El coordinador solo puede aprobar o rechazar solicitudes en estado IN_REVIEW. Estado actual: ${from}.`;
      }
      return `El coordinador no puede transicionar de ${from} a ${to}. Solo puede aprobar o rechazar solicitudes en revision.`;
    }
    if (actorRole === 'ADMIN') {
      return `El administrador no puede transicionar de ${from} a ${to} aunque tiene permisos operativos; debe respetar el workflow institucional.`;
    }
    return `Transicion no permitida para el rol ${actorRole}: ${from} -> ${to}.`;
  }

  async getRequestTypes() {
    return this.prisma.requestType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getAllRequestTypes() {
    return this.prisma.requestType.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createRequestType(dto: CreateRequestTypeDto) {
    return this.prisma.requestType.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        estimatedDays: dto.estimatedDays,
      },
    });
  }

  async updateRequestType(id: string, dto: UpdateRequestTypeDto) {
    const type = await this.prisma.requestType.findUnique({ where: { id } });
    if (!type) {
      throw new NotFoundException('Request type not found');
    }

    return this.prisma.requestType.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        estimatedDays: dto.estimatedDays,
      },
    });
  }

  async deleteRequestType(id: string) {
    const type = await this.prisma.requestType.findUnique({ where: { id } });
    if (!type) {
      throw new NotFoundException('Request type not found');
    }

    return this.prisma.requestType.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getRequestTypeStats(typeId: string) {
    const type = await this.prisma.requestType.findUnique({
      where: { id: typeId },
    });
    if (!type) {
      throw new NotFoundException('Tipo de solicitud no encontrado');
    }

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, thisMonth, byStatus] = await Promise.all([
      this.prisma.request.count({ where: { requestTypeId: typeId } }),
      this.prisma.request.count({
        where: {
          requestTypeId: typeId,
          createdAt: { gte: firstDayOfMonth },
        },
      }),
      this.prisma.request.groupBy({
        by: ['status'],
        where: { requestTypeId: typeId },
        _count: { status: true },
      }),
    ]);

    const counts: Record<string, number> = {};
    for (const entry of byStatus) {
      counts[entry.status] = entry._count.status;
    }

    const approved = counts['APPROVED'] || 0;
    const rejected = counts['REJECTED'] || 0;
    const approvalDenominator = approved + rejected;
    const approvalRate =
      approvalDenominator > 0 ? (approved / approvalDenominator) * 100 : 0;

    return {
      total,
      thisMonth,
      approvalRate: Math.round(approvalRate * 10) / 10,
    };
  }

  async getStats(userId: string, role: RoleName) {
    const where = role === 'STUDENT' ? { userId } : {};

    const [byStatus, recentActivity] = await Promise.all([
      this.prisma.request.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      this.prisma.request.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          trackingNumber: true,
          title: true,
          status: true,
          updatedAt: true,
          user: { select: { fullName: true } },
          requestType: { select: { name: true } },
        },
      }),
    ]);

    const counts: Record<string, number> = {};
    for (const entry of byStatus) {
      counts[entry.status] = entry._count.status;
    }

    return {
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      draft: counts['DRAFT'] || 0,
      submitted: counts['SUBMITTED'] || 0,
      inReview: (counts['IN_REVIEW'] || 0) + (counts['PENDING_DOCUMENTS'] || 0),
      approved: counts['APPROVED'] || 0,
      rejected: counts['REJECTED'] || 0,
      cancelled: counts['CANCELLED'] || 0,
      recentActivity,
    };
  }

  async getAcademicStats() {
    const now = new Date();
    const finalStatuses: RequestStatus[] = [
      'APPROVED',
      'REJECTED',
      'CANCELLED',
    ];

    // Start of current week (Monday)
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ...
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(now.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    // 1. Indicadores Académicos (4 parallel counts)
    const [
      certificatesIssued,
      homologationsApproved,
      requestsFinalized,
      cancellations,
    ] = await Promise.all([
      this.prisma.request.count({
        where: {
          status: 'APPROVED',
          requestType: { name: 'Certificado' },
        },
      }),
      this.prisma.request.count({
        where: {
          status: 'APPROVED',
          requestType: { name: 'Homologación' },
        },
      }),
      this.prisma.request.count({
        where: { status: { in: finalStatuses } },
      }),
      this.prisma.request.count({
        where: { status: 'CANCELLED' },
      }),
    ]);

    // 2. Rendimiento Operativo
    // Load finalized requests with minimal data for averageResponseTime and sla
    const finalizedRequests = await this.prisma.request.findMany({
      where: { status: { in: finalStatuses } },
      select: {
        createdAt: true,
        updatedAt: true,
        requestType: { select: { estimatedDays: true } },
      },
    });

    let averageResponseTime = 0;
    let sla = 0;

    if (finalizedRequests.length > 0) {
      let totalDays = 0;
      let withinSLA = 0;

      for (const req of finalizedRequests) {
        const days =
          (req.updatedAt.getTime() - req.createdAt.getTime()) /
          (1000 * 60 * 60 * 24);
        totalDays += days;
        if (days <= req.requestType.estimatedDays) {
          withinSLA++;
        }
      }

      averageResponseTime =
        Math.round((totalDays / finalizedRequests.length) * 10) / 10;
      sla = Math.round((withinSLA / finalizedRequests.length) * 1000) / 10;
    }

    // processedThisWeek
    const processedThisWeek = await this.prisma.request.count({
      where: {
        status: { in: finalStatuses },
        updatedAt: { gte: startOfWeek },
      },
    });

    // overdueCases and expiringSoon - combined query for efficiency
    const activeRequests = await this.prisma.request.findMany({
      where: { status: { notIn: finalStatuses } },
      select: {
        createdAt: true,
        requestType: { select: { estimatedDays: true } },
      },
    });

    let overdueCases = 0;
    let expiringSoon = 0;
    const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

    for (const req of activeRequests) {
      const daysSinceCreation =
        (now.getTime() - req.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const deadlineMs =
        req.createdAt.getTime() +
        req.requestType.estimatedDays * 24 * 60 * 60 * 1000;
      const timeToDeadline = deadlineMs - now.getTime();

      if (daysSinceCreation > req.requestType.estimatedDays) {
        overdueCases++;
      } else if (timeToDeadline < twentyFourHoursInMs && timeToDeadline > 0) {
        expiringSoon++;
      }
    }

    // 3. Alertas (3 parallel counts)
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    const [pendingOver5Days, pendingSignature, pendingDocuments] =
      await Promise.all([
        this.prisma.request.count({
          where: {
            status: { notIn: finalStatuses },
            requestType: { name: 'Homologación' },
            createdAt: { lte: fiveDaysAgo },
          },
        }),
        this.prisma.request.count({
          where: {
            status: 'APPROVED',
            officialDocuments: { none: {} },
          },
        }),
        this.prisma.request.count({
          where: { status: 'PENDING_DOCUMENTS' },
        }),
      ]);

    return {
      certificatesIssued,
      homologationsApproved,
      requestsFinalized,
      cancellations,
      averageResponseTime,
      processedThisWeek,
      overdueCases,
      sla,
      expiringSoon,
      pendingOver5Days,
      pendingSignature,
      pendingDocuments,
    };
  }

  private async changeStatusInternal(
    id: string,
    newStatus: RequestStatus,
    expectedStatus: RequestStatus,
    userId: string | null,
    comment: string | null,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.request.updateMany({
        where: { id, status: expectedStatus },
        data: { status: newStatus },
      });

      if (result.count === 0) {
        throw new ConflictException(
          'El estado de la solicitud fue modificado por otro proceso',
        );
      }

      const request = await tx.request.findUnique({
        where: { id },
        include: {
          requestType: true,
          user: { select: { id: true, fullName: true, email: true } },
        },
      });

      if (!request) {
        throw new NotFoundException('Solicitud no encontrada');
      }

      await tx.requestHistory.create({
        data: {
          requestId: id,
          previousStatus: expectedStatus,
          newStatus,
          userId,
          comment,
        },
      });

      return request;
    });

    this.emitStatusChanged(updated, expectedStatus, userId, comment);
    return updated;
  }

  private emitStatusChanged(
    request: {
      id: string;
      trackingNumber: string;
      title: string;
      status: RequestStatus;
      requestType: { name: string };
      user: { id: string; email: string; fullName: string };
    },
    previousStatus: RequestStatus,
    actorId: string | null,
    comment: string | null,
  ) {
    try {
      this.eventEmitter.emit('request.status.changed', {
        requestId: request.id,
        trackingNumber: request.trackingNumber,
        title: request.title,
        newStatus: request.status,
        previousStatus,
        studentId: request.user.id,
        studentEmail: request.user.email,
        studentName: request.user.fullName,
        requestTypeName: request.requestType.name,
        actorId,
        comment,
      });
    } catch {
      // best-effort: event emission failure must not break request flow
    }
  }

  private generateTrackingNumber(): string {
    const prefix = 'SA';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }
}
