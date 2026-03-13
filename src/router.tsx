import React from 'react'
import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { HomeOutlined, HeartOutlined, EnvironmentOutlined, AccountBookOutlined } from '@ant-design/icons'

const Home = React.lazy(() => import('./modules/home'))
const BodyManagement = React.lazy(() => import('./modules/body-management'))
const Travel = React.lazy(() => import('./modules/travel'))
const Accounting = React.lazy(() => import('./modules/accounting'))

export type RouteConfig = RouteObject & {
  /** 侧边栏显示名称，不设则不显示在菜单中 */
  label?: string
  /** 菜单图标 */
  icon?: React.ReactNode
}

/**
 * 路由配置（集中管理）
 * 添加新模块只需在此数组中追加一项。
 * 菜单会根据此配置自动生成。
 */
export const routes: RouteConfig[] = [
  {
    path: '/',
    element: (
      <React.Suspense fallback={null}>
        <Home />
      </React.Suspense>
    ),
    label: '首页',
    icon: <HomeOutlined />,
  },
  {
    path: '/body-management',
    element: (
      <React.Suspense fallback={null}>
        <BodyManagement />
      </React.Suspense>
    ),
    label: '身材管理',
    icon: <HeartOutlined />,
  },
  {
    path: '/travel',
    element: (
      <React.Suspense fallback={null}>
        <Travel />
      </React.Suspense>
    ),
    label: '旅行足迹',
    icon: <EnvironmentOutlined />,
  },
  {
    path: '/accounting',
    element: (
      <React.Suspense fallback={null}>
        <Accounting />
      </React.Suspense>
    ),
    label: '记账',
    icon: <AccountBookOutlined />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]
