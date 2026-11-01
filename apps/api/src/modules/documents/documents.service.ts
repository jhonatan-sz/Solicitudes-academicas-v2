import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageProvider, StorageResult } from './storage/storage.interface';
import { LocalStorage } from './storage/local.storage';
import { RoleName } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import {
  RBAC_ERROR_MESSAGES,
  STUDENT_UPLOAD_ALLOWED_STATES,
  canActorDeleteDocuments,
  canActorUploadDocuments,
  isFinalStatus,
} from '../../common/rbac/request-workflow.rules';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_REQUEST = 5;

@Injectable()
export class DocumentsService {
  private storage: StorageProvider;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    localStorage: LocalStorage,
  ) {
    this.storage = localStorage;
  }

  async upload(
    file: Express.Multer.File,
    requestId: string,
    userId: string,
    role: RoleName,
  ) {
    if (!canActorUploadDocuments(role)) {
      throw new ForbiddenException(
        role === 'STAFF'
          ? RBAC_ERROR_MESSAGES.STAFF_CANNOT_UPLOAD
          : role === 'COORDINATOR'
            ? RBAC_ERROR_MESSAGES.COORDINATOR_CANNOT_UPLOAD
            : 'No tienes permisos para subir documentos.',
      );
    }

    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    this.validateFile(file);

    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      select: { userId: true, status: true },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (isFinalStatus(request.status)) {
      throw new ForbiddenException(
        RBAC_ERROR_MESSAGES.CANNOT_UPLOAD_IN_FINAL_STATE(request.status),
      );
    }

    if (role === 'STUDENT' && request.userId !== userId) {
      throw new ForbiddenException(
        RBAC_ERROR_MESSAGES.CANNOT_UPLOAD_OTHER_REQUESTS,
      );
    }

    if (
      role === 'STUDENT' &&
      !STUDENT_UPLOAD_ALLOWED_STATES.includes(request.status)
    ) {
      throw new ForbiddenException(
        `El estudiante solo puede subir documentos en estado DRAFT o PENDING_DOCUMENTS. Estado actual: ${request.status}.`,
      );
    }

    const attachmentCount = await this.prisma.attachment.count({
      where: { requestId },
    });

    if (attachmentCount >= MAX_ATTACHMENTS_PER_REQUEST) {
      throw new ConflictException(
        `Se alcanzó el máximo de ${MAX_ATTACHMENTS_PER_REQUEST} adjuntos por solicitud`,
      );
    }

    const ext = MIME_TO_EXT[file.mimetype] || '';
    const uuid = randomUUID();
    const storageFileName = `${uuid}${ext}`;

    let storageResult: StorageResult;
    try {
      storageResult = await this.storage.upload(
        file.buffer,
        storageFileName,
        file.mimetype,
      );
    } catch {
      throw new BadRequestException('Error al almacenar el archivo');
    }

    try {
      const attachment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.attachment.create({
          data: {
            requestId,
            fileName: storageResult.fileName,
            originalName: file.originalname,
            url: storageResult.url,
            mimeType: file.mimetype,
            fileSize: storageResult.fileSize,
            provider: 'local',
            uploadedBy: userId,
          },
          include: {
            uploader: { select: { id: true, fullName: true, email: true } },
          },
        });

        await tx.requestHistory.create({
          data: {
            requestId,
            previousStatus: request.status,
            newStatus: request.status,
            userId,
            comment: `Document uploaded: ${file.originalname}`,
          },
        });

        return created;
      });

      return attachment;
    } catch (error) {
      try {
        await this.storage.delete(storageFileName);
      } catch {
        // Limpieza best-effort: si falla, el error original es el que importa.
      }
      throw error;
    }
  }

  async findByRequest(requestId: string, userId: string, role: RoleName) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      select: { userId: true },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (role === 'STUDENT' && request.userId !== userId) {
      throw new ForbiddenException(
        'Solo puedes ver documentos de tus propias solicitudes',
      );
    }

    return this.prisma.attachment.findMany({
      where: { requestId },
      include: {
        uploader: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, role: RoleName) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        request: { select: { userId: true } },
        uploader: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Adjunto no encontrado');
    }

    if (role === 'STUDENT' && attachment.request.userId !== userId) {
      throw new ForbiddenException(
        'Solo puedes ver documentos de tus propias solicitudes',
      );
    }

    return attachment;
  }

  async download(
    id: string,
    userId: string,
    role: RoleName,
  ): Promise<{ stream: Readable; mimeType: string; fileName: string }> {
    const attachment = await this.findOne(id, userId, role);

    if (!(await this.storage.fileExists(attachment.fileName))) {
      throw new NotFoundException('Archivo no encontrado en almacenamiento');
    }

    const stream = await this.storage.getStream(attachment.fileName);
    return {
      stream,
      mimeType: attachment.mimeType,
      fileName: attachment.originalName,
    };
  }

  async remove(id: string, userId: string, role: RoleName) {
    if (!canActorDeleteDocuments(role)) {
      throw new ForbiddenException(
        role === 'STAFF'
          ? RBAC_ERROR_MESSAGES.STAFF_CANNOT_DELETE
          : role === 'COORDINATOR'
            ? RBAC_ERROR_MESSAGES.COORDINATOR_CANNOT_DELETE
            : 'No tienes permisos para eliminar documentos.',
      );
    }

    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: { request: { select: { userId: true, status: true } } },
    });

    if (!attachment) {
      throw new NotFoundException('Adjunto no encontrado');
    }

    if (isFinalStatus(attachment.request.status)) {
      throw new ForbiddenException(
        RBAC_ERROR_MESSAGES.CANNOT_DELETE_IN_FINAL_STATE(
          attachment.request.status,
        ),
      );
    }

    if (role === 'STUDENT') {
      if (attachment.request.userId !== userId) {
        throw new ForbiddenException(
          'Solo puedes eliminar documentos de tus propias solicitudes.',
        );
      }
      if (attachment.uploadedBy !== userId) {
        throw new ForbiddenException(
          RBAC_ERROR_MESSAGES.CANNOT_DELETE_OTHER_USERS_DOCUMENTS,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.requestHistory.create({
        data: {
          requestId: attachment.requestId,
          previousStatus: attachment.request.status,
          newStatus: attachment.request.status,
          userId,
          comment: `Document deleted: ${attachment.originalName}`,
        },
      });

      await tx.attachment.delete({ where: { id } });
    });

    try {
      await this.storage.delete(attachment.fileName);
    } catch {
      // El registro ya se borró en BD: si el archivo físico falla, no se revierte.
    }

    return { message: 'Adjunto eliminado', id };
  }

  private validateFile(file: Express.Multer.File) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo '${file.mimetype}' no permitido. Permitidos: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `El tamaño del archivo (${Math.round(file.size / 1024)}KB) excede el máximo permitido (${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB)`,
      );
    }
  }
}
