import { useEffect, useState, type ReactElement } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  CalendarCheck2,
  CalendarDays,
  Clock3,
  LayoutDashboard,
  ListTodo,
  Menu,
  Plus,
  Settings as SettingsIcon,
  Tags,
  UserRound,
  WifiOff,
  X
} from 'lucide-react'
import { useActivityDialog } from '../context/ActivityDialogContext'
import { useSettings } from '../hooks/useSettings'
import { useAppInfo } from '../hooks/useAppInfo'
import { formatDateFromDate } from '../utils/date'
import { ActivityDialogHost } from './ActivityDialogHost'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/actividades', label: 'Mis actividades', icon: ListTodo },
  { to: '/categorias', label: 'Categorías', icon: Tags },
  { to: '/disponibilidad', label: 'Horarios disponibles', icon: Clock3 },
  { to: '/configuracion', label: 'Configuración', icon: SettingsIcon }
]

export function AppLayout(): ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { openCreate } = useActivityDialog()
  const settings = useSettings()
  const appInfo = useAppInfo()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Dashboard',
      '/calendario': 'Calendario',
      '/actividades': 'Mis actividades',
      '/categorias': 'Categorías',
      '/disponibilidad': 'Horarios disponibles',
      '/configuracion': 'Configuración'
    }
    document.title = `${titles[location.pathname] ?? 'LifeSync'} · LifeSync`
  }, [location.pathname])

  const userName = settings.data?.userName?.trim() ?? ''
  const initial = userName ? userName.charAt(0).toUpperCase() : <UserRound size={18} />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Navegación principal">
        <div className="sidebar-brand">
          <span className="brand-mark">
            <CalendarCheck2 size={25} />
          </span>
          <span className="brand-text">
            <strong>LifeSync</strong>
            <small>Organizador personal</small>
          </span>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-caption">Mi espacio</span>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                aria-label={item.label}
                title={item.label}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="user-avatar">{initial}</span>
            <span className="user-text">
              <strong>{userName || 'Mi espacio'}</strong>
              <small>LifeSync v{appInfo.data?.appVersion ?? '1.0.0'}</small>
            </span>
          </div>
          <span className="offline-note">
            <WifiOff size={14} /> Funciona sin conexión
          </span>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-button menu-toggle"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu size={21} />
          </button>
          <div className="topbar-date">
            <CalendarDays size={17} />
            <span>{formatDateFromDate(new Date())}</span>
          </div>
          <div className="topbar-actions">
            <span className="offline-chip">
              <WifiOff size={14} /> Sin conexión
            </span>
            <button
              type="button"
              className="button primary small"
              onClick={() => openCreate()}
            >
              <Plus size={17} /> Nueva actividad
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      <ActivityDialogHost />
    </div>
  )
}
