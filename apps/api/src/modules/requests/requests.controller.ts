import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { CreateRequestTypeDto } from './dto/create-request-type.dto';
import { UpdateRequestTypeDto } from './dto/update-request-type.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { QueryRequestsDto } from './dto/query-requests.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}

@ApiTags('Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('STUDENT', 'ADMIN')
  @ApiOperation({
    summary: 'Crear nueva solicitud (Borrador)',
    description:
      'Crea una nueva solicitud académica en estado borrador. STUDENT solo puede crear para sí mismo. ADMIN puede crear para cualquier estudiante activo.',
  })
  @ApiCreatedResponse({ description: 'Solicitud creada exitosamente' })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente o inválido',
  })
  @ApiForbiddenResponse({
    description: 'Solo STUDENT y ADMIN pueden crear solicitudes',
  })
  @ApiBadRequestResponse({ description: 'Cuerpo de solicitud inválido' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateRequestDto) {
    const role = req.user.role as 'STUDENT' | 'ADMIN';
    return this.requestsService.create(req.user.id, role, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar solicitudes con paginación',
    description:
      'Los estudiantes solo ven sus propias solicitudes. Funcionarios, coordinadores y administradores ven todas las solicitudes.',
  })
  @ApiOkResponse({ description: 'Lista paginada de solicitudes' })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente o inválido',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'DRAFT',
      'SUBMITTED',
      'IN_REVIEW',
      'PENDING_DOCUMENTS',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
    ],
  })
  @ApiQuery({ name: 'requestTypeId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  findAll(@Req() req: AuthenticatedRequest, @Query() query: QueryRequestsDto) {
    const role = req.user.role as 'STUDENT' | 'STAFF' | 'COORDINATOR' | 'ADMIN';
    return this.requestsService.findAll(req.user.id, role, query);
  }

  @Get('types')
  @ApiOperation({
    summary: 'Listar tipos de solicitud activos',
    description:
      'Retorna todos los tipos de solicitud activos (Certificado, Homologación, etc.) disponibles para crear solicitudes.',
  })
  @ApiOkResponse({ description: 'Lista de tipos de solicitud activos' })
  getTypes() {
    return this.requestsService.getRequestTypes();
  }

  @Get('types/all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Listar todos los tipos de solicitud (admin)',
    description:
      'Retorna todos los tipos de solicitud incluyendo los inactivos. Solo administrador.',
  })
  @ApiOkResponse({ description: 'Lista de todos los tipos de solicitud' })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente o inválido',
  })
  @ApiForbiddenResponse({ description: 'Permisos insuficientes' })
  getAllTypes() {
    return this.requestsService.getAllRequestTypes();
  }

  @Post('types')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Crear tipo de solicitud',
    description: 'Crea un nuevo tipo de solicitud. Solo administrador.',
  })
  @ApiCreatedResponse({ description: 'Tipo de solicitud creado exitosamente' })
  @ApiBadRequestResponse({ description: 'Cuerpo de solicitud inválido' })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente o inválido',
  })
  @ApiForbiddenResponse({ description: 'Permisos insuficientes' })
  @ApiConflictResponse({
    description: 'Ya existe un tipo de solicitud con ese nombre',
  })
  createType(@Body() dto: CreateRequestTypeDto) {
    return this.requestsService.createRequestType(dto);
  }

  @Patch('types/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Actualizar tipo de solicitud',
    description:
      'Actualiza un tipo de solicitud existente. Solo administrador.',
  })
  @ApiOkResponse({ description: 'Tipo de solicitud actualizado exitosamente' })
  @ApiBadRequestResponse({ description: 'Cuerpo de solicitud inválido' })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente o inválido',
  })
  @ApiForbiddenResponse({ description: 'Permisos insuficientes' })
  @ApiNotFoundResponse({ description: 'Tipo de solicitud no encontrado' })
  @ApiConflictResponse({
    description: 'Ya existe un tipo de solicitud con ese nombre',
  })
  updateType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestTypeDto,
  ) {
    return this.requestsService.updateRequestType(id, dto);
  }

  @Delete('types/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Desactivar tipo de solicitud',
    description:
      'Desactiva un tipo de solicitud estableciendo isActive en false. Solo administrador.',
  })
  @ApiOkResponse({ description: 'Tipo de solicitud desactivado exitosamente' })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente o inválido',
  })
  @ApiForbiddenResponse({ description: 'Permisos insuficientes' })
  @ApiNotFoundResponse({ description: 'Tipo de solicitud no encontrado' })
  deleteType(@Param('id', ParseUUIDPipe) id: string) {
    return this.requestsService.deleteRequestType(id);
  }

  @Get('types/:id/stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Estadísticas de uso de un tipo de solicitud',
    description:
      'Retorna el total de solicitudes, solicitudes del mes y tasa de aprobación para un tipo específico. Solo administrador.',
  })
  @ApiOkResponse({ description: 'Estadísticas del tipo de solicitud' })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente o inválido',
  })
  @ApiForbiddenResponse({ description: 'Permisos insuficientes' })
  @ApiNotFoundResponse({ description: 'Tipo de solicitud no encontrado' })
  getTypeStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.requestsService.getRequestTypeStats(id);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Obtener estadísticas del panel',
    description:
      'Retorna conteos de solicitudes por estado y actividad reciente. Los estudiantes solo ven sus propias estadísticas; funcionarios y superiores ven estadísticas globales.',
  })
  @ApiOkResponse({
    description:
      'Estadísticas del panel con conteos por estado y actividad reciente',
  })
  stats(@Req() req: AuthenticatedRequest) {
    const role = req.user.role as 'STUDENT' | 'STAFF' | 'COORDINATOR' | 'ADMIN';
    return this.requestsService.getStats(req.user.id, role);
  }

  @Get('academic-stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'COORDINATOR', 'STAFF')
  @ApiOperation({
    summary: 'Estadísticas académicas para el Dashboard',
    description:
      'Retorna métricas reales de indicadores académicos, rendimiento operativo y alertas. Solo ADMIN, COORDINATOR y STAFF.',
  })
  @ApiOkResponse({ description: 'Estadísticas académicas' })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente o inválido',
  })
  @ApiForbiddenResponse({ description: 'Permisos insuficientes' })
  getAcademicStats() {
    return this.requestsService.getAcademicStats();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de solicitud',
    description:
      'Retorna los detalles completos de la solicitud incluyendo adjuntos, historial e información del usuario.',
  })
  @ApiOkResponse({
    description: 'Detalle de solicitud con adjuntos e historial',
  })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada' })
  @ApiForbiddenResponse({
    description: 'El estudiante solo puede ver sus propias solicitudes',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const role = req.user.role as 'STUDENT' | 'STAFF' | 'COORDINATOR' | 'ADMIN';
    return this.requestsService.findOne(id, req.user.id, role);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar borrador de solicitud',
    description:
      'Actualiza el título o descripción de una solicitud. STUDENT solo puede editar propias en DRAFT. STAFF/COORDINATOR/ADMIN pueden editar propias; ADMIN puede editar metadata de cualquier solicitud no final.',
  })
  @ApiOkResponse({ description: 'Solicitud actualizada exitosamente' })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada' })
  @ApiForbiddenResponse({
    description:
      'No es el propietario, la solicitud está en estado final, o el rol no tiene permisos',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestDto,
  ) {
    const role = req.user.role as 'STUDENT' | 'STAFF' | 'COORDINATOR' | 'ADMIN';
    return this.requestsService.update(id, req.user.id, role, dto);
  }

  @Post(':id/submit')
  @ApiOperation({
    summary: 'Enviar solicitud',
    description:
      'Transiciona una solicitud de BORRADOR a ENVIADA. STUDENT solo puede enviar propias. ADMIN puede enviar cualquier solicitud en DRAFT.',
  })
  @ApiOkResponse({ description: 'Solicitud enviada exitosamente' })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada' })
  @ApiConflictResponse({
    description: 'La solicitud no está en estado BORRADOR',
  })
  @ApiForbiddenResponse({ description: 'No es el propietario de la solicitud' })
  submit(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const role = req.user.role as 'STUDENT' | 'ADMIN';
    return this.requestsService.submit(id, req.user.id, role);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancelar solicitud',
    description:
      'Cancela una solicitud. STUDENT solo puede cancelar propias. ADMIN puede cancelar cualquier solicitud no final.',
  })
  @ApiOkResponse({ description: 'Solicitud cancelada exitosamente' })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada' })
  @ApiForbiddenResponse({
    description: 'No es el propietario o la solicitud está en un estado final',
  })
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const role = req.user.role as 'STUDENT' | 'ADMIN';
    return this.requestsService.cancel(id, req.user.id, role);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('STAFF', 'COORDINATOR', 'ADMIN')
  @ApiOperation({
    summary: 'Cambiar estado de solicitud',
    description:
      'Los funcionarios pueden mover a EN_REVISIÓN o DOCUMENTOS_PENDIENTES. Los coordinadores pueden APROBAR o RECHAZAR. Los administradores tienen control total.',
  })
  @ApiOkResponse({ description: 'Estado cambiado exitosamente' })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada' })
  @ApiBadRequestResponse({
    description: 'Se requiere un motivo al rechazar una solicitud',
  })
  @ApiForbiddenResponse({
    description: 'Permisos insuficientes o transición de estado inválida',
  })
  @ApiConflictResponse({
    description:
      'La solicitud ya está en el estado objetivo o en un estado final',
  })
  changeStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    const role = req.user.role as 'STAFF' | 'COORDINATOR' | 'ADMIN';
    return this.requestsService.changeStatus(id, dto, req.user.id, role);
  }
}
