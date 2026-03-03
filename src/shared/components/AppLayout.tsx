import { useState, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Drawer, Button, theme, Grid } from 'antd'
import type { MenuProps } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { routes, type RouteConfig } from '../../router'

const { Header, Sider, Content } = Layout
const { useBreakpoint } = Grid

/** 根据路由配置自动生成菜单项 */
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

export default function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

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
    />
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isMobile ? (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={200}
          styles={{ body: { padding: 0 } }}
        >
          <div style={{ height: 32, margin: 16, fontWeight: 700, fontSize: 18, textAlign: 'center', lineHeight: '32px' }}>
            个人助手
          </div>
          {menuContent}
        </Drawer>
      ) : (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme="light"
        >
          <div
            style={{
              height: 32,
              margin: 16,
              fontWeight: 700,
              fontSize: collapsed ? 14 : 18,
              textAlign: 'center',
              lineHeight: '32px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {collapsed ? '助手' : '个人助手'}
          </div>
          {menuContent}
        </Sider>
      )}
      <Layout>
        <Header
          style={{
            padding: isMobile ? '0 12px' : '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            fontSize: 16,
            fontWeight: 600,
            gap: 8,
          }}
        >
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
            />
          )}
          {routes.find((r) => r.path === location.pathname)?.label ?? ''}
        </Header>
        <Content
          style={{
            margin: isMobile ? 8 : 24,
            padding: isMobile ? 12 : 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 280,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
