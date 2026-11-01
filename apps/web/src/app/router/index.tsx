import { createBrowserRouter } from 'react-router-dom'
import { AuthLayout } from '../layouts/auth-layout'
import { DashboardLayout } from '../layouts/dashboard-layout'
import { ProtectedRoute } from './protected-route'
import { AdminRoute } from './admin-route'
import { RoleGuard } from './role-guard'
import { CatchAllRedirect } from './catch-all-redirect'
import { LoginPage } from '@/pages/login/login-page'
import { DashboardPage } from '@/pages/dashboard/dashboard-page'
import { RequestsPage } from '@/pages/requests/requests-page'
import { DocumentsPage } from '@/pages/documents/documents-page'
import { AdminUsersPage } from '@/pages/admin/admin-users-page'
import { AdminRequestTypesPage } from '@/pages/admin/admin-request-types-page'
import { SettingsPage } from '@/pages/settings/settings-page'
import { NotificationsPage } from '@/pages/notifications/notifications-page'
import { ProfilePage } from '@/pages/profile/profile-page'
import { CreateRequest } from '@/features/requests/components/create-request'
import { RequestDetail } from '@/features/requests/components/request-detail'

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
    ],
  },
  {
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/dashboard',
        element: <DashboardPage />,
      },
      {
        path: '/dashboard/requests',
        element: <RequestsPage />,
      },
      {
        path: '/dashboard/requests/new',
        element: (
          <RoleGuard allow={['STUDENT', 'ADMIN']}>
            <CreateRequest />
          </RoleGuard>
        ),
      },
      {
        path: '/dashboard/requests/:id',
        element: <RequestDetail />,
      },
      {
        path: '/dashboard/admin/users',
        element: <AdminRoute><AdminUsersPage /></AdminRoute>,
      },
      {
        path: '/dashboard/admin/request-types',
        element: <AdminRoute><AdminRequestTypesPage /></AdminRoute>,
      },
      {
        path: '/dashboard/documents',
        element: <DocumentsPage />,
      },
      {
        path: '/dashboard/notifications',
        element: <NotificationsPage />,
      },
      {
        path: '/dashboard/settings',
        element: <SettingsPage />,
      },
      {
        path: '/dashboard/profile',
        element: <ProfilePage />,
      },
    ],
  },
  {
    path: '*',
    element: <CatchAllRedirect />,
  },
])

