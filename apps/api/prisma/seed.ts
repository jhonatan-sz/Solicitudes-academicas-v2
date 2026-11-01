import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import {
  NotificationChannel,
  PrismaClient,
  RequestStatus,
  RoleName,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/** Contraseña única de las cuentas de demostración (solo entorno local). */
const DEMO_PASSWORD = 'Demo1234!';

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function seedRoles() {
  const roles = await Promise.all(
    [
      RoleName.STUDENT,
      RoleName.STAFF,
      RoleName.COORDINATOR,
      RoleName.ADMIN,
    ].map(async (name) => {
      const created = await prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      console.log(`  Role: ${created.name}`);
      return created;
    }),
  );

  return new Map(roles.map((role) => [role.name, role.id]));
}

async function seedRequestTypes() {
  const requestTypes = [
    {
      name: 'Certificado',
      description: 'Solicitud de certificado académico',
      estimatedDays: 3,
    },
    {
      name: 'Homologación',
      description: 'Solicitud de homologación de materias',
      estimatedDays: 15,
    },
    {
      name: 'Cancelación',
      description: 'Cancelación de materias o semestre',
      estimatedDays: 5,
    },
    {
      name: 'Paz y salvo',
      description: 'Solicitud de paz y salvo institucional',
      estimatedDays: 3,
    },
    {
      name: 'Recurso',
      description: 'Recurso de apelación sobre una nota o decisión',
      estimatedDays: 10,
    },
  ];

  for (const rt of requestTypes) {
    const created = await prisma.requestType.upsert({
      where: { name: rt.name },
      update: {},
      create: rt,
    });
    console.log(`  RequestType: ${created.name}`);
  }
}

async function seedUsers(roleIds: Map<RoleName, string>) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const demoUsers = [
    {
      email: 'admin@demo.edu.co',
      fullName: 'Valentina Ríos',
      documentNumber: '1000000001',
      role: RoleName.ADMIN,
    },
    {
      email: 'funcionario@demo.edu.co',
      fullName: 'Carlos Mendoza',
      documentNumber: '1000000002',
      role: RoleName.STAFF,
    },
    {
      email: 'coordinador@demo.edu.co',
      fullName: 'Adriana Torres',
      documentNumber: '1000000003',
      role: RoleName.COORDINATOR,
    },
    {
      email: 'estudiante@demo.edu.co',
      fullName: 'Jhonatan Sánchez',
      documentNumber: '1000000004',
      role: RoleName.STUDENT,
      program: 'Ingeniería de Sistemas',
      semester: 9,
      studentCode: '2020-1234',
    },
    {
      email: 'camila@demo.edu.co',
      fullName: 'Camila Herrera',
      documentNumber: '1000000005',
      role: RoleName.STUDENT,
      program: 'Ingeniería Industrial',
      semester: 5,
      studentCode: '2022-5678',
    },
  ];

  const users = new Map<string, string>();

  for (const demo of demoUsers) {
    const roleId = roleIds.get(demo.role);
    if (!roleId) throw new Error(`Rol no encontrado: ${demo.role}`);

    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: {},
      create: {
        email: demo.email,
        passwordHash,
        fullName: demo.fullName,
        documentNumber: demo.documentNumber,
        roleId,
      },
    });

    if (demo.role === RoleName.STUDENT) {
      await prisma.studentProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          program: demo.program,
          semester: demo.semester,
          studentCode: demo.studentCode,
        },
      });
    }

    users.set(demo.email, user.id);
    console.log(`  User: ${user.email}`);
  }

  return users;
}

type DemoHistoryEntry = {
  to: RequestStatus;
  by: string;
  days: number;
  comment: string;
};

type DemoRequest = {
  trackingNumber: string;
  title: string;
  description: string;
  status: RequestStatus;
  userId: string;
  type: string;
  days: number;
  assignedTo?: string;
  history: DemoHistoryEntry[];
};

async function seedRequests(users: Map<string, string>) {
  const student = users.get('estudiante@demo.edu.co')!;
  const student2 = users.get('camila@demo.edu.co')!;
  const staff = users.get('funcionario@demo.edu.co')!;
  const coordinator = users.get('coordinador@demo.edu.co')!;

  const requestTypes = await prisma.requestType.findMany({
    select: { id: true, name: true },
  });
  const typeByName = new Map(requestTypes.map((t) => [t.name, t.id]));

  const demoRequests: DemoRequest[] = [
    {
      trackingNumber: 'SOL-2026-0001',
      title: 'Certificado de estudio para trámite bancario',
      description:
        'Requiero el certificado de estudio vigente para un trámite de crédito.',
      status: RequestStatus.APPROVED,
      userId: student,
      type: 'Certificado',
      days: 12,
      history: [
        {
          to: RequestStatus.SUBMITTED,
          by: student,
          days: 12,
          comment: 'Solicitud enviada.',
        },
        {
          to: RequestStatus.IN_REVIEW,
          by: staff,
          days: 11,
          comment: 'Recibida por registro.',
        },
        {
          to: RequestStatus.APPROVED,
          by: coordinator,
          days: 9,
          comment: 'Cumple los requisitos.',
        },
      ],
    },
    {
      trackingNumber: 'SOL-2026-0002',
      title: 'Homologación de bases de datos',
      description:
        'Solicito homologar la materia Bases de Datos cursada en intercambio.',
      status: RequestStatus.IN_REVIEW,
      userId: student,
      type: 'Homologación',
      days: 6,
      assignedTo: staff,
      history: [
        {
          to: RequestStatus.SUBMITTED,
          by: student,
          days: 6,
          comment: 'Solicitud enviada.',
        },
        {
          to: RequestStatus.IN_REVIEW,
          by: staff,
          days: 5,
          comment: 'En revisión académica.',
        },
      ],
    },
    {
      trackingNumber: 'SOL-2026-0003',
      title: 'Paz y salvo para grado',
      description:
        'Solicito el paz y salvo institucional para iniciar el proceso de grado.',
      status: RequestStatus.PENDING_DOCUMENTS,
      userId: student2,
      type: 'Paz y salvo',
      days: 4,
      assignedTo: staff,
      history: [
        {
          to: RequestStatus.SUBMITTED,
          by: student2,
          days: 4,
          comment: 'Solicitud enviada.',
        },
        {
          to: RequestStatus.IN_REVIEW,
          by: staff,
          days: 3,
          comment: 'Revisando antecedentes.',
        },
        {
          to: RequestStatus.PENDING_DOCUMENTS,
          by: staff,
          days: 2,
          comment: 'Falta cargar el recibo de pago de derechos de grado.',
        },
      ],
    },
    {
      trackingNumber: 'SOL-2026-0004',
      title: 'Cancelación de semestre por motivos de salud',
      description: 'Adjunto soporte médico para cancelar el semestre en curso.',
      status: RequestStatus.SUBMITTED,
      userId: student2,
      type: 'Cancelación',
      days: 2,
      history: [
        {
          to: RequestStatus.SUBMITTED,
          by: student2,
          days: 2,
          comment: 'Solicitud enviada.',
        },
      ],
    },
    {
      trackingNumber: 'SOL-2026-0005',
      title: 'Recurso de nota en Cálculo III',
      description: 'Solicito revisión de la nota final del curso Cálculo III.',
      status: RequestStatus.REJECTED,
      userId: student,
      type: 'Recurso',
      days: 15,
      history: [
        {
          to: RequestStatus.SUBMITTED,
          by: student,
          days: 15,
          comment: 'Solicitud enviada.',
        },
        {
          to: RequestStatus.IN_REVIEW,
          by: staff,
          days: 14,
          comment: 'En revisión.',
        },
        {
          to: RequestStatus.REJECTED,
          by: coordinator,
          days: 13,
          comment:
            'El recurso se presentó fuera del término reglamentario de cinco días.',
        },
      ],
    },
    {
      trackingNumber: 'SOL-2026-0006',
      title: 'Certificado de notas para beca',
      description: 'Necesito el certificado de notas del semestre anterior.',
      status: RequestStatus.DRAFT,
      userId: student,
      type: 'Certificado',
      days: 1,
      history: [],
    },
  ];

  for (const demo of demoRequests) {
    const requestTypeId = typeByName.get(demo.type);
    if (!requestTypeId) throw new Error(`Tipo no encontrado: ${demo.type}`);

    const existing = await prisma.request.findUnique({
      where: { trackingNumber: demo.trackingNumber },
      select: { id: true },
    });

    if (existing) {
      console.log(`  Request: ${demo.trackingNumber} (ya existe)`);
      continue;
    }

    await prisma.request.create({
      data: {
        trackingNumber: demo.trackingNumber,
        title: demo.title,
        description: demo.description,
        status: demo.status,
        userId: demo.userId,
        requestTypeId,
        assignedTo: demo.assignedTo,
        createdAt: daysAgo(demo.days),
        updatedAt: daysAgo(demo.days - 1),
        history: {
          create: demo.history.map((entry, index) => ({
            previousStatus: index > 0 ? demo.history[index - 1].to : null,
            newStatus: entry.to,
            userId: entry.by,
            comment: entry.comment,
            createdAt: daysAgo(entry.days),
          })),
        },
      },
    });

    console.log(`  Request: ${demo.trackingNumber}`);
  }

  const notificationCount = await prisma.notification.count({
    where: { userId: student },
  });

  if (notificationCount === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: student,
          channel: NotificationChannel.SYSTEM,
          subject: 'Tu solicitud SOL-2026-0001 fue aprobada',
          sent: true,
        },
        {
          userId: student,
          channel: NotificationChannel.SYSTEM,
          subject: 'SOL-2026-0002 pasó a revisión académica',
          sent: true,
        },
        {
          userId: student,
          channel: NotificationChannel.EMAIL,
          subject: 'Recordatorio: tienes un borrador sin enviar',
          sent: false,
        },
      ],
    });
  }
}

async function main() {
  console.log('Seeding database...');

  const roleIds = await seedRoles();
  await seedRequestTypes();
  const users = await seedUsers(roleIds);
  await seedRequests(users);

  console.log('Seed completed.');
  console.log(`Cuentas demo (contraseña: ${DEMO_PASSWORD}):`);
  for (const email of users.keys()) {
    console.log(`  ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
