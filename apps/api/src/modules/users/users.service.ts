import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { ChangeMyPasswordDto } from './dto/change-my-password.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import * as bcrypt from 'bcrypt';

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  documentNumber: true,
  isActive: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(query: QueryUsersDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { documentNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.role) {
      const roleRecord = await this.prisma.role.findUnique({
        where: { name: query.role },
        select: { id: true },
      });
      if (roleRecord) {
        where.roleId = roleRecord.id;
      }
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          ...USER_SELECT,
          role: { select: { id: true, name: true } },
          studentProfile: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_SELECT,
        role: { select: { id: true, name: true } },
        studentProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async getRoles() {
    return this.prisma.role.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async getUsersStats() {
    const [byRole, byStatus] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['roleId'],
        _count: { roleId: true },
      }),
      this.prisma.user.groupBy({
        by: ['isActive'],
        _count: { isActive: true },
      }),
    ]);

    const total = await this.prisma.user.count();

    const active =
      byStatus.find((s) => s.isActive === true)?._count.isActive ?? 0;
    const inactive =
      byStatus.find((s) => s.isActive === false)?._count.isActive ?? 0;

    const roleMap: Record<string, number> = {};
    for (const r of byRole) {
      roleMap[r.roleId] = r._count.roleId;
    }

    const studentRole = await this.prisma.role.findUnique({
      where: { name: 'STUDENT' },
      select: { id: true },
    });

    const students = studentRole ? (roleMap[studentRole.id] ?? 0) : 0;

    return { total, active, inactive, students };
  }

  async getUserRequestStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const byStatus = await this.prisma.request.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true },
    });

    const counts: Record<string, number> = {};
    for (const entry of byStatus) {
      counts[entry.status] = entry._count.status;
    }

    return {
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      approved: counts['APPROVED'] || 0,
      draft: counts['DRAFT'] || 0,
      pending:
        (counts['SUBMITTED'] || 0) +
        (counts['IN_REVIEW'] || 0) +
        (counts['PENDING_DOCUMENTS'] || 0),
    };
  }

  async getUserActivity(userId: string, limit = 10) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const [requests, history, attachments, officialDocs] = await Promise.all([
      this.prisma.request.findMany({
        where: { userId },
        select: {
          id: true,
          trackingNumber: true,
          title: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.requestHistory.findMany({
        where: { userId },
        select: {
          id: true,
          newStatus: true,
          comment: true,
          createdAt: true,
          request: {
            select: { id: true, trackingNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.attachment.findMany({
        where: { uploadedBy: userId },
        select: {
          id: true,
          originalName: true,
          createdAt: true,
          request: {
            select: { id: true, trackingNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.officialDocument.findMany({
        where: { generatedBy: userId },
        select: {
          id: true,
          type: true,
          createdAt: true,
          request: {
            select: { id: true, trackingNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    type ActivityItem = {
      id: string;
      type:
        | 'request_created'
        | 'status_changed'
        | 'document_uploaded'
        | 'document_generated';
      description: string;
      requestId?: string;
      trackingNumber?: string;
      createdAt: string;
    };

    const items: ActivityItem[] = [];

    for (const req of requests) {
      items.push({
        id: `req-${req.id}`,
        type: 'request_created',
        description: `Solicitud "${req.title}" creada`,
        requestId: req.id,
        trackingNumber: req.trackingNumber,
        createdAt: req.createdAt.toISOString(),
      });
    }

    for (const h of history) {
      items.push({
        id: `hist-${h.id}`,
        type: 'status_changed',
        description: `Estado cambiado a ${h.newStatus}`,
        requestId: h.request?.id,
        trackingNumber: h.request?.trackingNumber,
        createdAt: h.createdAt.toISOString(),
      });
    }

    for (const att of attachments) {
      items.push({
        id: `att-${att.id}`,
        type: 'document_uploaded',
        description: `Documento "${att.originalName}" cargado`,
        requestId: att.request?.id,
        trackingNumber: att.request?.trackingNumber,
        createdAt: att.createdAt.toISOString(),
      });
    }

    for (const doc of officialDocs) {
      const typeLabel =
        doc.type === 'CERTIFICATE'
          ? 'Certificado'
          : doc.type === 'CONSTANCY'
            ? 'Constancia'
            : 'Documento oficial';
      items.push({
        id: `doc-${doc.id}`,
        type: 'document_generated',
        description: `${typeLabel} generado`,
        requestId: doc.request?.id,
        trackingNumber: doc.request?.trackingNumber,
        createdAt: doc.createdAt.toISOString(),
      });
    }

    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return items.slice(0, limit);
  }

  async create(dto: CreateUserDto) {
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });

    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (role.name === 'STUDENT') {
      if (!dto.program || !dto.semester || !dto.studentCode) {
        throw new BadRequestException(
          'Programa, semestre y código estudiantil son requeridos para estudiantes',
        );
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          documentNumber: dto.documentNumber,
          roleId: dto.roleId,
        },
        select: {
          ...USER_SELECT,
          role: { select: { id: true, name: true } },
        },
      });

      if (role.name === 'STUDENT') {
        await tx.studentProfile.create({
          data: {
            userId: created.id,
            program: dto.program!,
            semester: dto.semester!,
            studentCode: dto.studentCode!,
          },
        });
      }

      return {
        ...created,
        studentProfile:
          role.name === 'STUDENT'
            ? await tx.studentProfile.findUnique({
                where: { userId: created.id },
              })
            : null,
      };
    });

    this.emitUserCreated(user);
    return user;
  }

  private emitUserCreated(user: {
    id: string;
    email: string;
    fullName: string;
    role: { name: string };
  }) {
    try {
      this.eventEmitter.emit('user.created', {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        roleName: user.role.name,
      });
    } catch {
      // best-effort: event emission failure must not break user creation
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true, studentProfile: true },
    });

    if (!existing) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const role = dto.roleId
      ? await this.prisma.role.findUnique({ where: { id: dto.roleId } })
      : existing.role;

    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (role.name === 'STUDENT') {
      const program = dto.program ?? existing.studentProfile?.program;
      const semester = dto.semester ?? existing.studentProfile?.semester;
      const studentCode =
        dto.studentCode ?? existing.studentProfile?.studentCode;

      if (!program || !semester || !studentCode) {
        throw new BadRequestException(
          'Programa, semestre y código estudiantil son requeridos para estudiantes',
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          email: dto.email,
          fullName: dto.fullName,
          documentNumber: dto.documentNumber,
          roleId: dto.roleId,
        },
        select: {
          ...USER_SELECT,
          role: { select: { id: true, name: true } },
        },
      });

      if (role.name === 'STUDENT') {
        await tx.studentProfile.upsert({
          where: { userId: id },
          update: {
            program: dto.program ?? existing.studentProfile?.program ?? '',
            semester: dto.semester ?? existing.studentProfile?.semester ?? 1,
            studentCode:
              dto.studentCode ?? existing.studentProfile?.studentCode ?? '',
          },
          create: {
            userId: id,
            program: dto.program!,
            semester: dto.semester!,
            studentCode: dto.studentCode!,
          },
        });
      }

      return {
        ...user,
        studentProfile:
          role.name === 'STUDENT'
            ? await tx.studentProfile.findUnique({ where: { userId: id } })
            : null,
      };
    });

    return updated;
  }

  async updateStatus(id: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        ...USER_SELECT,
        role: { select: { id: true, name: true } },
        studentProfile: true,
      },
    });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.prisma.$transaction(async (tx) => {
      const counts = await Promise.all([
        tx.request.count({ where: { userId: id } }),
        tx.attachment.count({ where: { uploadedBy: id } }),
      ]);

      if (counts[0] > 0 || counts[1] > 0) {
        throw new ConflictException(
          'El usuario tiene registros asociados. Desactívelo en lugar de eliminarlo.',
        );
      }

      await tx.studentProfile.deleteMany({ where: { userId: id } });
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.refreshToken.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    return { message: 'Usuario eliminado', id };
  }

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        documentNumber: true,
        role: { select: { name: true } },
        studentProfile: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async updateMyProfile(userId: string, dto: UpdateMyProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName,
        email: dto.email,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        documentNumber: true,
        role: { select: { name: true } },
        studentProfile: true,
        createdAt: true,
      },
    });
  }

  async changeMyPassword(userId: string, dto: ChangeMyPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const isValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isValid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    return { message: 'Contraseña actualizada correctamente' };
  }
}
