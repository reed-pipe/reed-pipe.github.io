import { useState, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Drawer, Button, Grid, Dropdown, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { MenuOutlined, UserOutlined, LogoutOutlined, SunOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons'
import { routes, type RouteConfig } from '../../router'
import { useAuthStore } from '../auth/store'
import SyncIndicator from '../sync/SyncIndicator'
import { useTheme, type ThemeMode } from '@/shared/hooks/useTheme'

const { Header, Sider, Content } = Layout
const { useBreakpoint } = Grid

function buildMenuItems(routeConfigs: RouteConfig[]): MenuProps['items'] {
  return routeConfigs
    .filter((r) => r.label)
    .map((r) => ({
      key: r.path ?? '/',
      icon: r.icon,
      label: r.label,
    }))
}

const menuItems = buildMenuItems(routes)

const themeLabels: Record<ThemeMode, string> = {
  light: '浅色模式',
  dark: '深色模式',
  system: '跟随系统',
}

function nextMode(current: ThemeMode): ThemeMode {
  if (current === 'light') return 'dark'
  if (current === 'dark') return 'system'
  return 'light'
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const { username, logout } = useAuthStore()
  const { isDark, colors, gradients, shadows, mode, setMode } = useTheme()

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
    if (isMobile) setDrawerOpen(false)
  }

  const menuContent = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={menuItems}
      onClick={onMenuClick}
      style={{ border: 'none', background: 'transparent' }}
    />
  )

  const logo = (
    <div style={{
      padding: collapsed ? '20px 8px 16px' : '20px 20px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <div style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        background: gradients.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: shadows.primary,
      }}>
        <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>P</span>
      </div>
      {!collapsed && (
        <span style={{
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: colors.text,
          whiteSpace: 'nowrap',
        }}>
          Personal Hub
        </span>
      )}
    </div>
  )

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'username',
      label: username,
      icon: <UserOutlined />,
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: logout,
    },
  ]

  const pageTitle = routes.find((r) => r.path === location.pathname)?.label ?? ''

  return (
    <Layout style={{ minHeight: '100vh', transition: 'background-color 0.3s ease' }}>
      {isMobile ? (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={240}
          styles={{
            body: { padding: 0, background: isDark ? colors.bg : '#FAFAFA', transition: 'background-color 0.3s ease' },
            header: { display: 'none' },
          }}
        >
          {logo}
          <div style={{ padding: '0 4px' }}>
            {menuContent}
          </div>
        </Drawer>
      ) : (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme={isDark ? 'dark' : 'light'}
          width={220}
          style={{
            background: isDark ? colors.bg : '#FAFAFA',
            borderRight: `1px solid ${colors.borderLight}`,
            transition: 'background-color 0.3s ease, border-color 0.3s ease',
          }}
        >
          {logo}
          <div style={{ padding: '0 4px' }}>
            {menuContent}
          </div>
        </Sider>
      )}

      <Layout style={{ background: isDark ? colors.bg : '#F7F7F8', transition: 'background-color 0.3s ease' }}>
        <Header
          style={{
            padding: isMobile ? '0 16px' : '0 28px',
            background: isDark ? 'rgba(28,28,28,0.85)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 56,
            lineHeight: '56px',
            borderBottom: `1px solid ${colors.borderLight}`,
            boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
          }}
        >
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
              style={{ marginRight: 4 }}
            />
          )}
          <span style={{
            flex: 1,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: colors.text,
            transition: 'color 0.3s ease',
          }}>
            {pageTitle}
          </span>
          <SyncIndicator />
          <Tooltip title={themeLabels[mode]}>
            <Button
              type="text"
              size="small"
              icon={mode === 'light' ? <SunOutlined /> : mode === 'dark' ? <MoonOutlined /> : <DesktopOutlined />}
              onClick={() => setMode(nextMode(mode))}
            />
          </Tooltip>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button
              type="text"
              size="small"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 20,
                padding: '4px 12px 4px 8px',
                height: 32,
              }}
            >
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: gradients.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                color: '#fff',
                fontWeight: 600,
              }}>
                {username?.charAt(0).toUpperCase()}
              </div>
              {!isMobile && (
                <span style={{ fontSize: 13, color: colors.textSecondary }}>{username}</span>
              )}
            </Button>
          </Dropdown>
        </Header>

        <Content
          style={{
            margin: isMobile ? 0 : 20,
            padding: isMobile ? '8px 12px 12px' : 24,
            background: isDark ? colors.bgElevated : '#fff',
            borderRadius: isMobile ? 0 : 16,
            minHeight: 280,
            boxShadow: isMobile ? 'none' : shadows.sm,
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
