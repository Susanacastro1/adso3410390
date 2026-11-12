import type { ReactElement } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ActivityDialogProvider } from './context/ActivityDialogContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppLayout } from './components/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { CalendarPage } from './pages/CalendarPage'
import { ActivitiesPage } from './pages/ActivitiesPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { AvailabilityPage } from './pages/AvailabilityPage'
import { SettingsPage } from './pages/SettingsPage'

export function App(): ReactElement {
  return (
    <ErrorBoundary>
      <ActivityDialogProvider>
        <HashRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="calendario" element={<CalendarPage />} />
              <Route path="actividades" element={<ActivitiesPage />} />
              <Route path="categorias" element={<CategoriesPage />} />
              <Route path="disponibilidad" element={<AvailabilityPage />} />
              <Route path="configuracion" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </ActivityDialogProvider>
    </ErrorBoundary>
  )
}
