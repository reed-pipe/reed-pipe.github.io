# 个人助手 (reed-pipe.github.io)

## 项目概述
模块化个人工具集，托管在 GitHub Pages。

## 技术栈
- React 18 + TypeScript + Vite
- React Router v7（懒加载）
- Zustand（状态管理）
- Ant Design（UI 组件库）
- Dexie.js（IndexedDB 本地持久化）

## 常用命令
```bash
npm run dev      # 本地开发服务器
npm run build    # 类型检查 + 生产构建
npm run preview  # 预览构建产物
```

## 项目结构
```
src/
├── modules/              # 功能模块（每个模块独立目录）
│   └── <module>/
│       ├── index.tsx     # 模块入口（default export）
│       └── components/   # 模块私有组件
├── shared/
│   ├── components/       # 公共组件（AppLayout 等）
│   ├── hooks/            # 公共 hooks
│   ├── utils/            # 工具函数
│   └── db/               # Dexie 数据库定义
├── router.tsx            # 路由配置（集中管理）
├── App.tsx               # 根组件
└── main.tsx              # 入口
```

## 添加新模块
1. `src/modules/<name>/index.tsx` — 导出页面组件
2. `src/router.tsx` — 添加路由配置（path, label, icon）
3. 菜单自动根据路由配置生成

## 约定
- 路径别名：`@/` → `src/`
- 路由懒加载：所有模块使用 `React.lazy()` 导入
- 本地数据持久化统一使用 `src/shared/db/` 中的 Dexie 实例
- 部署：push main 自动通过 GitHub Actions 部署

## Vite 配置
- `base: '/'`（用户名.github.io 仓库，根路径）
