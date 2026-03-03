import { useState, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, theme } from 'antd'
import type { MenuProps } from 'antd'
import { routes, type RouteConfig } from '../../router'

const { Header, Sider, Content } = Layout

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
  const navigate = useNavigate()
  const location = useLocation()
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
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
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={onMenuClick}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {routes.find((r) => r.path === location.pathname)?.label ?? ''}
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
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
