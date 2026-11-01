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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
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
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar usuarios con paginación',
    description:
      'Retorna una lista paginada de todos los usuarios. Permite buscar por nombre o número de documento, y filtrar por rol y estado activo.',
  })
  @ApiOkResponse({ description: 'Lista paginada de usuarios' })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente o inválido',
  })
  @ApiForbiddenResponse({ description: 'Permisos insuficientes' })
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get('roles')
  @ApiOperation({
    summary: 'Listar roles disponibles',
    description:
      'Retorna todos los roles con sus IDs. Se usa para la selección de roles en la creación y filtrado de usuarios.',
  })
  @ApiOkResponse({ description: 'Lista de roles' })
  getRoles() {
    return this.usersService.getRoles();
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Obtener estadísticas de usuarios',
    description:
      'Retorna conteos globales de usuarios: total, activos, inactivos y estudiantes.',
  })
  @ApiOkResponse({ description: 'Estadísticas de usuarios' })
  getStats() {
    return this.usersService.getUsersStats();
  }

  @Get(':id/request-stats')
  @ApiOperation({
    summary: 'Estadísticas de solicitudes de un usuario',
    description:
      'Retorna el total de solicitudes, aprobadas, borradores y pendientes de un usuario específico.',
  })
  @ApiOkResponse({ description: 'Estadísticas de solicitudes del usuario' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  getUserRequestStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getUserRequestStats(id);
  }

  @Get(':id/activity')
  @ApiOperation({
    summary: 'Actividad reciente de un usuario',
    description:
      'Retorna las últimas actividades del usuario: solicitudes creadas, cambios de estado, documentos subidos y documentos oficiales generados.',
  })
  @ApiOkResponse({ description: 'Lista de actividades recientes' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  getUserActivity(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getUserActivity(id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de usuario',
    description:
      'Retorna los detalles completos de un usuario incluyendo rol y perfil estudiantil.',
  })
  @ApiOkResponse({
    description: 'Detalle de usuario con rol y perfil estudiantil',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente o inválido',
  })
  @ApiForbiddenResponse({ description: 'Permisos insuficientes' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Crear nuevo usuario',
    description:
      'Crea un usuario con el rol indicado. Los estudiantes requieren programa, semestre y código estudiantil.',
  })
  @ApiCreatedResponse({ description: 'Usuario creado exitosamente' })
  @ApiBadRequestResponse({
    description:
      'Cuerpo de solicitud inválido o campos de estudiante faltantes',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente o inválido',
  })
  @ApiForbiddenResponse({ description: 'Permisos insuficientes' })
  @ApiNotFoundResponse({ description: 'Rol no encontrado' })
  @ApiConflictResponse({ description: 'Correo electrónico ya en uso' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar datos de usuario',
    description:
      'Actualiza los campos del usuario. Si se cambia al rol ESTUDIANTE, se requieren programa, semestre y código estudiantil.',
  })
  @ApiOkResponse({ description: 'Usuario actualizado exitosamente' })
  @ApiBadRequestResponse({
    description:
      'Cuerpo de solicitud inválido o campos de estudiante faltantes',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente o inválido',
  })
  @ApiForbiddenResponse({ description: 'Permisos insuficientes' })
  @ApiNotFoundResponse({ description: 'Usuario o rol no encontrado' })
  @ApiConflictResponse({ description: 'Correo electrónico ya en uso' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Activar o desactivar usuario',
    description:
      'Alterna el estado isActive. Los usuarios desactivados no pueden iniciar sesión.',
  })
  @ApiOkResponse({ description: 'Estado de usuario actualizado exitosamente' })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente o inválido',
  })
  @ApiForbiddenResponse({ description: 'Permisos insuficientes' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    if (req.user.id === id) {
      throw new BadRequestException('No puedes cambiar tu propio estado');
    }
    return this.usersService.updateStatus(id, dto.isActive);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar usuario',
    description:
      'Elimina un usuario y sus perfiles y tokens asociados. Falla si el usuario tiene solicitudes o adjuntos.',
  })
  @ApiOkResponse({ description: 'Usuario eliminado exitosamente' })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente o inválido',
  })
  @ApiForbiddenResponse({ description: 'Permisos insuficientes' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  @ApiConflictResponse({
    description:
      'El usuario tiene registros asociados y no puede ser eliminado',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
