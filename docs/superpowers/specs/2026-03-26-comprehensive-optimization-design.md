# Personal Hub 全面优化设计文档

> 日期：2026-03-26
> 状态：已确认
> 策略：三线并行，一轮集中上线

---

## 总览

将优化工作分为三条独立线路并行推进：

| 线路 | 目标 | 涉及范围 |
|------|------|----------|
| 基础层 | 稳固地基 | 同步机制、照片压缩、PWA、离线队列 |
| 体验层 | 视觉与交互升级 | 暗黑模式、骨架屏、无障碍、动画 |
| 功能层 | 模块增强 | 记账/身材/旅行/首页 |

三条线依赖关系：
- 体验层的暗黑模式需要先建立 CSS 变量体系，但不阻塞基础层和功能层
- 基础层的同步升级需要在功能层加字段（`updatedAt`、`deletedAt`）之前完成 schema 设计
- 其余工作互不阻塞

---

## 一、基础层

### 1.1 同步冲突检测

**现状**：`pullData` 采用 last-write-wins，清空所有表后 bulk-put。多设备并发编辑会导致数据丢失。

**方案**：
- 所有记录表增加 `updatedAt: number`（timestamp）字段
- Pull 逻辑从"清空 + 全量写入"改为逐条 merge：
  - 云端有、本地无 → 插入
  - 本地有、云端无 → 保留（下次 push 上传）
  - 双端都有 → 比较 `updatedAt`，取较新者
  - 双端都有且 `updatedAt` 相同但内容不同 → 标记冲突，UI 提示用户选择
- 删除操作改为软删除：增加 `deletedAt: number | null` 字段
  - 同步时传播删除状态
  - 本地定期清理超过 30 天的软删除记录

**数据库变更**：
- Dexie 升级至 v7
- 所有记录表新增索引 `updatedAt`
- 新增 `syncConflicts` 表：`++id, table, recordId, localData, remoteData, createdAt`

**UI 变更**：
- SyncIndicator 增加冲突计数 badge
- 冲突解决界面：对比面板，左右展示两个版本，用户选择保留哪个

### 1.2 照片压缩

**现状**：旅行照片直接 base64 存储，单张 3-5MB，base64 后膨胀 33%。

**方案**：
- 新增 `@/shared/utils/imageCompress.ts`：
  - `compressImage(file: File, maxWidth: number, quality: number): Promise<string>`
  - 使用 Canvas API 缩放 + toDataURL
- 上传流程：
  - 原图压缩：长边 ≤ 1200px，JPEG quality 0.8（~150KB/张）
  - 缩略图生成：长边 ≤ 300px，JPEG quality 0.6（~20KB/张）
- 存储结构：照片字段从 `string` 改为 `{ full: string, thumb: string }`
- 列表/卡片展示用缩略图，点击/详情用原图
- 向后兼容：检测旧格式（纯 string），读取时当作 full 处理

### 1.3 PWA 修复

**现状**：
- Manifest `theme_color` 为 `#1677ff`（Ant 蓝），与品牌橙 `#F5722D` 不匹配
- 192px icon 未标记 maskable
- 无离线 fallback 页面

**方案**：
- `vite.config.ts` 中 manifest 修改：
  - `theme_color` → `#F5722D`
  - `background_color` → `#FFFFFF`
  - 192px icon 增加 `purpose: 'any maskable'`
- 新增 `public/offline.html`：简洁的离线提示页，品牌色 + "请检查网络连接"
- Workbox 配置增加 `navigateFallback: '/offline.html'`

### 1.4 离线同步队列

**现状**：离线时同步失败，无重试，用户无感知。

**方案**：
- Dexie 新增 `syncQueue` 表：`++id, action, table, recordId, data, createdAt`
- 数据变更时同时写入 syncQueue
- 监听 `window.addEventListener('online', flushSyncQueue)`
- 网络恢复时按队列顺序重放变更，成功后清除队列
- SyncIndicator 显示待同步条数（如 "3 条待同步"）
- 超过 3 次重试失败的条目标记为 error，用户可手动重试或丢弃

---

## 二、体验层

### 2.1 暗黑模式

**方案**：

**Token 体系改造**：
- `theme.ts` 重构为导出函数 `getThemeTokens(mode: 'light' | 'dark')`
- 语义变量名不变（`colors.text`、`colors.bg` 等），值按模式切换
- CSS 变量方案：`:root` 定义 light token，`[data-theme="dark"]` 覆盖

**Dark token 示例**：
```
bg:          #FFFFFF → #141414
bgSecondary: #F7F7F8 → #1F1F1F
text:        #1A1A1A → #E8E8E8
textSecondary: #8C8C8C → #A0A0A0
border:      #F0F0F0 → #303030
cardBg:      #FFFFFF → #1C1C1C
```

**状态管理**：
- 新增 `useThemeStore`（Zustand + localStorage 持久化）
- 支持三种模式：`light` / `dark` / `system`（跟随系统）
- `system` 模式监听 `prefers-color-scheme` 变化

**UI 入口**：
- AppLayout Header 右侧加主题切换按钮（太阳/月亮图标）
- 切换动画：0.3s transition on `background-color`, `color`, `border-color`

**特殊处理**：
- 记账模块 hero 区（已是深色 `#18181B`）：暗黑模式下调整为稍浅的 `#242424`，保持层次感
- 地图 tiles：切换为暗色地图图层（CartoDB dark_matter）
- Ant Design：`ConfigProvider` 的 `algorithm` 按模式切换

### 2.2 骨架屏

**方案**：
- 新增 `@/shared/components/Skeleton/` 目录：
  - `CardSkeleton.tsx` — 首页仪表板卡片占位
  - `ListSkeleton.tsx` — 列表类占位（记账流水、体重列表）
  - `ChartSkeleton.tsx` — 图表区域占位
- 基于 Ant Design `Skeleton` 组件 + `active` 脉冲效果
- 各模块 `useLiveQuery` 返回 `undefined` 时渲染对应骨架屏
- 骨架屏尺寸与实际组件一致，避免加载完成后布局跳动

### 2.3 无障碍（A11y）

**方案**：
- SVG 可视化组件（MiniSparkline、MiniDonut）：
  - 添加 `role="img"` + `aria-label`（动态描述数据，如"过去14天体重趋势，从72.5kg到71.8kg"）
- Modal / Drawer：
  - 确保 `autoFocus` 和焦点陷阱（Ant Design 默认支持，检查自定义 Modal）
  - ESC 关闭行为统一验证
- 旅行底部面板：
  - 添加 `role="dialog"` + `aria-label`
  - 键盘可达：Tab 聚焦面板，Enter/Space 切换 snap 位置
- 颜色对比度：
  - 暗黑模式所有文本 vs 背景对比度 ≥ 4.5:1（WCAG AA）
  - 使用工具逐一验证 dark token 组合

### 2.4 动画统一

**方案**：

**Stagger 动画改造**：
```css
/* 从硬编码 nth-child 改为 CSS 变量 */
.stagger-children > * {
  animation: fadeInUp 0.4s ease both;
  animation-delay: calc(var(--i, 0) * 0.06s);
}
```
组件中：`style={{ '--i': index } as React.CSSProperties}`

**清理**：
- 移除未使用的 `shimmer` keyframe
- 移除 `pulseGlow`（如未使用）

**统一规范**：
- 交互反馈（hover, active）：`0.2s ease`
- 布局变化（展开/折叠/切换）：`0.35s cubic-bezier(0.4, 0, 0.2, 1)`
- 页面进场：`0.4s ease` + stagger

**Reduced motion**：
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 三、功能层

### 3.1 记账模块增强

**定期记账**：
- 新增 `AccRecurring` 表：
  ```
  id: number (auto-increment)
  ledgerId: number
  type: TransactionType
  categoryId: number
  amount: number
  note: string
  tags: string[]
  frequency: 'daily' | 'weekly' | 'monthly'
  startDate: string    // "YYYY-MM-DD"
  endDate: string | null  // null = 永久
  lastGeneratedDate: string | null
  isActive: boolean
  createdAt: number
  ```
- Dexie 索引：`++id, ledgerId, frequency, isActive, createdAt`
- 打开记账模块时执行 `generateRecurringTransactions()`：
  - 查询所有 `isActive` 的定期规则
  - 从 `lastGeneratedDate` 到今天，按频率生成缺失的交易记录
  - 更新 `lastGeneratedDate`
- UI：预算页旁新增"定期"Tab，列表展示所有规则，支持增删改、暂停/恢复

**快捷记账优化**：
- 记忆最近 5 次使用的"分类 + 金额"组合
- QuickEntry 组件顶部展示快捷标签，点击一键填充
- 数据来源：查询最近 30 天交易，按分类+金额分组，取频率 top 5

### 3.2 身材管理模块增强

**围度图表补全**：
- `MeasurementChart` 升级为多维折线图：
  - X 轴：日期
  - Y 轴：cm
  - 每个围度指标一条线，可通过 legend 切换显示/隐藏
  - 增加腰臀比（WHR = waist / hip）计算线
- 使用 Canvas 或 SVG 手绘图表（与现有 WeightChart 风格一致）

**CSV 数据导入**：
- 新增 `@/shared/components/CsvImporter.tsx`（可复用组件）：
  - 拖拽/选择 CSV 文件
  - 解析预览：表格展示前 10 行
  - 字段映射：用户选择哪列对应日期、体重、体脂等
  - 冲突检测：同日期已有记录时标黄，用户选择覆盖/跳过
  - 确认导入，写入 Dexie

### 3.3 旅行模块增强

**列表虚拟化**：
- 行程列表使用 `content-visibility: auto` + `contain-intrinsic-size`
- 卡片高度预估 180px（有封面）/ 120px（无封面）
- 浏览器自动跳过视口外卡片的渲染，100+ 行程流畅

**地图标记懒加载**：
- 监听 Leaflet `moveend` 事件，只渲染当前 bounds 内的标记点
- 缩放层级低（看全国）时聚合为 cluster marker

**移动端底部面板手势**：
- touch 事件实现拖拽：
  - `touchstart` 记录起始 Y
  - `touchmove` 计算 deltaY，实时更新面板高度（`transform: translateY`）
  - `touchend` 根据速度 + 位置就近 snap
- snap 位置：peek（15vh）、half（50vh）、full（85vh）
- 惯性：手指释放时的速度超过阈值则滑向下一个 snap

### 3.4 首页仪表板增强

**智能摘要**：
- 顶部新增摘要卡片，根据数据动态生成提醒文案：
  - 体重连续记录天数提醒
  - 预算使用百分比预警（≥80% 时橙色，≥100% 红色）
  - 即将到来的旅行倒计时
  - 今日未记账/未记体重提醒
- 无数据时显示引导文案

**卡片排序**：
- 仪表板卡片支持拖拽排序（framer-motion 的 `Reorder` 组件）
- 顺序持久化到 Dexie `kv` 表（key: `dashboard_order`）
- 默认顺序：体重 → 记账 → 旅行

---

## 四、数据库变更汇总

Dexie v7 升级：

```typescript
db.version(7).stores({
  kv: 'key',
  weightRecords: '++id, date, createdAt, updatedAt',
  bodyMeasurements: '++id, date, createdAt, updatedAt',
  trips: '++id, startDate, createdAt, updatedAt',
  tripSpots: '++id, tripId, date, createdAt, updatedAt',
  ledgers: '++id, sortOrder, createdAt, updatedAt',
  accCategories: '++id, type, sortOrder, createdAt, updatedAt',
  accTransactions: '++id, ledgerId, type, categoryId, date, createdAt, updatedAt, [ledgerId+date], [ledgerId+type+date]',
  accBudgets: '++id, yearMonth, categoryId, createdAt, updatedAt, [yearMonth+categoryId]',
  accRecurring: '++id, ledgerId, frequency, isActive, createdAt',
  syncQueue: '++id, action, table, recordId, createdAt',
  syncConflicts: '++id, table, recordId, createdAt',
})
```

所有现有记录的 `updatedAt` 通过升级 hook 填充为 `createdAt` 值，`deletedAt` 默认 `null`。

---

## 五、不在本轮范围

- 新模块（待用户确定方向后单独设计）
- 后端/服务器（保持纯前端 + GitHub Gist 架构）
- 单元测试（可作为后续独立迭代）
- 国际化（当前仅中文，暂不需要）
