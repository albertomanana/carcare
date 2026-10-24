import { type ComponentType, lazy, type LazyExoticComponent, Suspense } from 'react'
import { createBrowserRouter, Outlet, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { PageSpinner } from '@/components/ui/Spinner'
import { AppIndexRedirect, GuestOnly, RequireAuth } from '@/features/auth/guards'
import { NotFoundPage } from '@/features/errors/NotFoundPage'
import { RouteError } from '@/features/errors/RouteError'
import { DefaultWorkspaceRoute, WorkspaceRoute } from '@/features/workspace/WorkspaceRoute'

// Cada pantalla es un chunk propio (carga inicial ligera; three.js solo llega con las pantallas 3D)
const Landing = lazy(() => import('@/features/landing/LandingPage'))
const Login = lazy(() => import('@/features/auth/LoginPage'))
const Register = lazy(() => import('@/features/auth/RegisterPage'))
const Dashboard = lazy(() => import('@/features/dashboard/DashboardPage'))
const Garage = lazy(() => import('@/features/garage/GaragePage'))
const VehicleForm = lazy(() => import('@/features/vehicle/VehicleFormPage'))
const VehicleDetail = lazy(() => import('@/features/vehicle/VehicleDetailPage'))
const OverviewTab = lazy(() => import('@/features/vehicle/tabs/OverviewTab'))
const JournalTab = lazy(() => import('@/features/vehicle/tabs/JournalTab'))
const HistoryTab = lazy(() => import('@/features/vehicle/tabs/HistoryTab'))
const ExpensesTab = lazy(() => import('@/features/vehicle/tabs/ExpensesTab'))
const RemindersTab = lazy(() => import('@/features/vehicle/tabs/RemindersTab'))
const DocumentsTab = lazy(() => import('@/features/vehicle/tabs/DocumentsTab'))
const DataTab = lazy(() => import('@/features/vehicle/tabs/DataTab'))
const VehicleOrdersTab = lazy(() => import('@/features/vehicle/tabs/OrdersTab'))
const MaintenanceForm = lazy(() => import('@/features/maintenance/MaintenanceFormPage'))
const Report = lazy(() => import('@/features/report/ReportPage'))
const Agenda = lazy(() => import('@/features/agenda/AgendaPage'))
const Analytics = lazy(() => import('@/features/analytics/AnalyticsPage'))
const Orders = lazy(() => import('@/features/workshop/OrdersPage'))
const NewOrder = lazy(() => import('@/features/workshop/NewOrderPage'))
const OrderDetail = lazy(() => import('@/features/workshop/OrderDetailPage'))
const OrderSummary = lazy(() => import('@/features/workshop/OrderSummaryPage'))
const Customers = lazy(() => import('@/features/workshop/CustomersPage'))
const CustomerDetail = lazy(() => import('@/features/workshop/CustomerDetailPage'))
const WorkshopFloor = lazy(() => import('@/features/workshop/WorkshopFloorPage'))
const Team = lazy(() => import('@/features/workshop/TeamPage'))
const Settings = lazy(() => import('@/features/settings/SettingsPage'))

function page(Component: LazyExoticComponent<ComponentType>) {
  return <Component />
}

/** Contenedor con Suspense para rutas fuera del AppShell. */
function SuspenseOutlet() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Outlet />
    </Suspense>
  )
}

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/dev/3d',
        Component: lazy(() => import('@/features/dev/ThreeLabPage')),
      },
    ]
  : []

export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    element: <SuspenseOutlet />,
    children: [
      { path: '/', element: page(Landing) },
      { path: '/entrar', element: <GuestOnly>{page(Login)}</GuestOnly> },
      { path: '/registro', element: <GuestOnly>{page(Register)}</GuestOnly> },
      {
        path: '/app',
        element: <RequireAuth />,
        children: [
          { index: true, element: <AppIndexRedirect /> },
          {
            path: 'ajustes',
            element: <DefaultWorkspaceRoute />,
            children: [{ element: <AppShell />, children: [{ index: true, element: page(Settings) }] }],
          },
          {
            path: ':ws',
            element: <WorkspaceRoute />,
            children: [
              { path: 'vehiculos/:vehicleId/informe', element: page(Report) },
              { path: 'ordenes/:orderId/resumen', element: page(OrderSummary) },
              {
                element: <AppShell />,
                children: [
                  { index: true, element: page(Dashboard) },
                  { path: 'garaje', element: page(Garage) },
                  { path: 'vehiculos/nuevo', element: page(VehicleForm) },
                  { path: 'vehiculos/:vehicleId/editar', element: page(VehicleForm) },
                  { path: 'vehiculos/:vehicleId/intervenciones/nueva', element: page(MaintenanceForm) },
                  { path: 'vehiculos/:vehicleId/intervenciones/:recordId/editar', element: page(MaintenanceForm) },
                  {
                    path: 'vehiculos/:vehicleId',
                    element: page(VehicleDetail),
                    children: [
                      { index: true, element: page(OverviewTab) },
                      { path: 'diario', element: page(JournalTab) },
                      { path: 'historial', element: page(HistoryTab) },
                      { path: 'gastos', element: page(ExpensesTab) },
                      { path: 'recordatorios', element: page(RemindersTab) },
                      { path: 'documentos', element: page(DocumentsTab) },
                      { path: 'datos', element: page(DataTab) },
                      { path: 'ordenes', element: page(VehicleOrdersTab) },
                    ],
                  },
                  { path: 'agenda', element: page(Agenda) },
                  { path: 'analitica', element: page(Analytics) },
                  { path: 'ordenes', element: page(Orders) },
                  { path: 'ordenes/nueva', element: page(NewOrder) },
                  { path: 'ordenes/:orderId', element: page(OrderDetail) },
                  { path: 'clientes', element: page(Customers) },
                  { path: 'clientes/:customerId', element: page(CustomerDetail) },
                  { path: 'taller', element: page(WorkshopFloor) },
                  { path: 'equipo', element: page(Team) },
                  { path: '*', element: <NotFoundPage /> },
                ],
              },
            ],
          },
        ],
      },
      ...devRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export function createAppRouter() {
  return createBrowserRouter(routes)
}
