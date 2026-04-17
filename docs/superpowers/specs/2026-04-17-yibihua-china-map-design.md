# 一笔画地图（中国版）· 设计文档

- **日期**：2026-04-17
- **作者**：reed-pipe
- **状态**：设计完成，待实现
- **目标平台**：抖音小游戏
- **目标周期**：4 周 MVP 上线

## 1. 项目概述

「一笔画地图」是面向抖音小游戏平台的休闲解谜游戏，核心玩法是**用手指一笔走遍每个省份/区域，每块只能经过一次**。MVP 第一版以「中国省级行政区」为主题，后续按章节解锁世界国家、城市地标、历史版图等。

**目标**：

- 4 周内独立开发完成 MVP 并上线
- 通过激励视频广告变现（无内购）
- 自然流量 + 自剪短视频引流

**用户**：独立开发者，0 预算，全栈自负。

## 2. 需求确认（已与用户对齐）

| # | 维度 | 决策 |
|---|------|------|
| 1 | 主题架构 | 多章节系统，MVP 仅填充第 1 章「中国省份」，其他章节显示「即将开放」 |
| 2 | 玩法变体 | 填色覆盖（Flow / Color Cover）—— 一笔走遍每色块 |
| 3 | 关卡粒度 | 递进式：小关 30 + 中关 20 + 大关 10 + 终极 4 = **64 关** |
| 4 | 广告位 | 4 个：① 失败复活 ② 提示 ③ 撤销 ④ 双倍金币 |
| 5 | 美术风格 | 中国风水墨朱砂（差异化强、主题契合） |
| 6 | 交互方式 | 手指拖动连续画（一笔运笔感） |
| 7 | 进度系统 | 标准三件套：金币 + 每关 3 星 + 章节顺序解锁 |
| 8 | 声音方案 | 免费库（freesound + zapsplat）+ CC0 中国风 BGM |
| 9 | 仓库 | 新建独立 GitHub 仓库 `yibihua-china-map` |

## 3. 架构选型：方案 1 数据驱动单引擎

**选定原因**：

- 4 周 MVP 时间约束下，唯一可达的方案
- "多章节解锁"愿景本质就是"换数据"，与单引擎数据驱动完美契合
- 在引擎中预留 `onStart / onMove / onWin` 三个钩子，未来加新机制（必经点等）改动可控
- 避免方案 2（插件化）的过度设计陷阱

**舍弃方案 2（插件化模式）**：开发量增加 30-50%，4 周不可达。
**舍弃方案 3（每章节独立 Scene）**：重复代码多、维护噩梦、6 周以上才能完成。

## 4. 项目骨架与技术栈

### 4.1 技术栈

| 项 | 选型 |
|---|---|
| 引擎 | Cocos Creator 3.8 LTS |
| 语言 | TypeScript |
| 目标平台 | 抖音小游戏（构建产物 byte-mini-game） |
| SDK | 抖音小游戏 SDK 全局 `tt.*` API |
| 数据预处理 | Node.js + `d3-geo` + `topojson-client` |
| 本地存档 | `tt.setStorageSync / getStorageSync` |
| 包体上限 | 抖音首包 4MB（必须分包） |

### 4.2 目录结构

```
yibihua-china-map/
├── assets/
│   ├── scripts/
│   │   ├── engine/                    # 核心引擎
│   │   │   ├── GameEngine.ts          # 引擎门面 + 钩子注册
│   │   │   ├── MapRenderer.ts         # SVG 渲染省份色块
│   │   │   ├── PathTracker.ts         # 记录玩家走过的块
│   │   │   ├── InputHandler.ts        # 拖动/触摸事件
│   │   │   ├── WinChecker.ts          # 胜利判定（注入 onWin 钩子）
│   │   │   ├── UndoStack.ts           # 撤销栈
│   │   │   └── HintCalculator.ts      # 提示算法（DFS 找通路）
│   │   ├── scenes/                    # 场景控制器
│   │   │   ├── HomeScene.ts
│   │   │   ├── ChapterScene.ts
│   │   │   ├── GameScene.ts
│   │   │   └── ResultScene.ts
│   │   ├── managers/                  # 全局管理器（单例）
│   │   │   ├── AdsManager.ts          # 抖音激励视频包装
│   │   │   ├── SaveManager.ts         # 本地存档读写
│   │   │   ├── AudioManager.ts        # BGM + 音效
│   │   │   └── DataManager.ts         # 关卡 JSON 加载
│   │   ├── ui/                        # UI 弹窗组件
│   │   │   ├── HintDialog.ts          # 金币 or 看广告
│   │   │   ├── ResurrectDialog.ts     # 失败复活
│   │   │   ├── DoubleRewardDialog.ts  # 结算双倍
│   │   │   └── ChapterCard.ts
│   │   └── utils/
│   │       ├── geometry.ts            # SVG 几何辅助
│   │       └── ink-effects.ts         # 中国风水墨笔触效果
│   ├── resources/
│   │   ├── levels/                    # 关卡数据（动态 require）
│   │   │   └── chapter1-china/
│   │   │       ├── meta.json
│   │   │       ├── level-001.json
│   │   │       └── ... (~64 个)
│   │   ├── maps/                      # 地图 SVG（章节资源包）
│   │   │   └── china-provinces.svg
│   │   ├── audio/
│   │   │   ├── bgm-guqin.mp3
│   │   │   ├── sfx-brush.mp3
│   │   │   └── sfx-complete.mp3
│   │   └── ui/                        # 朱砂红/水墨纹理
│   └── scenes/                        # Cocos 场景文件
│       ├── Home.scene
│       ├── Chapter.scene
│       └── Game.scene
├── tools/                             # 关卡数据生产管线（Node.js）
│   ├── geojson-to-levels.js
│   ├── adjacency-builder.js
│   └── level-validator.js
├── docs/
└── package.json
```

## 5. 数据模型

### 5.1 关卡数据 Schema (`level-XXX.json`)

```json
{
  "id": "ch1-l001",
  "chapter": "chapter1-china",
  "tier": "small",                  // small | medium | large | ultimate
  "order": 1,                       // 章节内顺序
  "title": "华北启程",
  "description": "京 津 冀 晋 蒙",

  "blocks": [
    {
      "id": "京",
      "name": "北京",
      "svgPath": "M120,30 L160,30 L160,55 L120,55 Z",
      "centroid": [140, 42],
      "color": "#ef9a9a"
    }
    // ... 5 个块
  ],

  "adjacency": {
    "京": ["津", "冀"],
    "津": ["京", "冀"],
    "冀": ["京", "津", "晋", "蒙"],
    "晋": ["冀", "蒙"],
    "蒙": ["冀", "晋"]
  },

  "validStarts": ["京", "蒙"],

  "starThresholds": {
    "3": { "maxHints": 0, "maxUndos": 1, "maxTimeSec": 30 },
    "2": { "maxHints": 1, "maxUndos": 3, "maxTimeSec": 60 },
    "1": { "maxHints": 999, "maxUndos": 999, "maxTimeSec": 999 }
  },
  // 评定逻辑：从 3 星往下匹配，必须三个条件 (hints/undos/time) 全部 ≤ 阈值才得该星

  "rewards": { "coinsBase": 50, "coinsPerStar": 10 },
  "freeUndoQuota": 3
}
```

### 5.2 章节元数据 Schema (`meta.json`)

```json
{
  "id": "chapter1-china",
  "title": "中华大地",
  "subtitle": "走遍三十四省",
  "icon": "ui/chapter1-icon.png",
  "totalLevels": 64,
  "tiers": [
    { "name": "小关", "tierKey": "small",    "count": 30, "unlockAfter": null },
    { "name": "中关", "tierKey": "medium",   "count": 20, "unlockAfter": { "tier": "small",  "completedCount": 15 } },
    { "name": "大关", "tierKey": "large",    "count": 10, "unlockAfter": { "tier": "medium", "completedCount": 10 } },
    { "name": "终极", "tierKey": "ultimate", "count": 4,  "unlockAfter": { "tier": "large",  "completedCount": 5  } }
  ],
  // unlockAfter 语义：完成前一 tier 的 N 个关卡（不要求顺序，达到数量即可）
  "unlocked": true,
  "comingSoonAfter": "chapter1-china"
}
```

### 5.3 本地存档 Schema (`save.json`)

```json
{
  "version": 1,
  "totalCoins": 230,
  "currentChapter": "chapter1-china",
  "unlockedChapters": ["chapter1-china"],

  "levelProgress": {
    "ch1-l001": { "stars": 3, "bestTimeSec": 24, "completedAt": 1776417862 },
    "ch1-l002": { "stars": 2, "bestTimeSec": 47, "completedAt": 1776417999 }
  },

  "lastPlayedLevel": "ch1-l003",
  "consecutiveLoginDays": 5,
  "lastLoginDate": "2026-04-17",

  "settings": {
    "soundEnabled": true,
    "bgmVolume": 0.6,
    "sfxVolume": 1.0
  },

  "adsStats": {
    "totalWatched": 47,
    "lastWatchedAt": 1776417999
  }
}
```

### 5.4 关键设计取舍

- **关卡 SVG 路径直接放在 JSON 里**：避免 SVG 文件加载，单关数据完全自包含，约 5-30KB/关
- **邻接表预计算并存档**：运行时无需做几何计算，O(1) 查询
- **章节 lazy load**：只加载当前章节的关卡 JSON，控制首包大小
- **存档版本号**：未来加字段时通过 version 字段做迁移
- **"未解锁章节"占位**：通过 `comingSoonAfter` 实现"即将开放"的悬念展示

## 6. 核心引擎模块

所有模块位于 `assets/scripts/engine/`。

### 6.1 GameEngine.ts · 门面 + 钩子注册

```typescript
class GameEngine {
  private level: LevelData;
  private renderer: MapRenderer;
  private tracker: PathTracker;
  private input: InputHandler;
  private undo: UndoStack;

  hooks = {
    onStart: (level: LevelData) => void,
    onMove:  (block: Block, path: Block[]) => void,
    onWin:   (stars: number, stats: Stats) => void
  }

  loadLevel(level: LevelData): void
  startGame(): void
  pause(): void
  resume(): void
  reset(): void
}
```

### 6.2 MapRenderer.ts · 渲染省份色块

- 用 Cocos `Graphics` 节点直接绘制 SVG path
- 水墨风采用**双轨渲染**（详见第 13 节风险缓解）：开发期用 SVG filter（`feTurbulence`）模拟宣纸边缘；构建期把每省份预渲染成 PNG 纹理打入资源包，运行时用纹理（避免低端机 SVG filter 卡顿）
- 已走过：fill 朱砂红 + 楷体省名变白
- 未走过：fill 米黄 + 楷体省名墨色
- 当前手指位置：实时绘制运笔轨迹（贝塞尔曲线 + 笔触粗细变化）

### 6.3 PathTracker.ts · 路径状态机

```typescript
class PathTracker {
  visited: Block[]
  current: Block | null
  isValidNext(block: Block): boolean    // 邻接 + 未访问
  visit(block: Block): void
  rollback(steps: number): void
  isComplete(): boolean                 // 全部访问完
  isStuck(): boolean                    // 卡死（无可走且未完成）
}
```

### 6.4 InputHandler.ts · 拖动事件

- 监听 `touch-start / touch-move / touch-end`
- start：判定是否点中起点；不是则忽略
- move：每帧检测手指坐标落在哪个块的 SVG 路径内（用 `Polygon.contains` ray casting）
- 命中新块：调用 `tracker.visit()`，触发 `onMove` 钩子
- end：调用 `WinChecker.check()`
- 容错：手指偏出 < 8px 仍算在块内

### 6.5 WinChecker.ts · 胜利判定

```typescript
function check(tracker: PathTracker, level: LevelData): WinResult {
  if (!tracker.isComplete()) return { win: false }
  const stars = calcStars(stats, level.starThresholds)
  return {
    win: true,
    stars,                  // 1 / 2 / 3
    coins: level.rewards.coinsBase + stars * level.rewards.coinsPerStar
  }
}
```

### 6.6 UndoStack.ts · 撤销栈

- 每次 `visit` 时压栈，pop 即撤销
- 免费撤销次数 = `level.freeUndoQuota`（默认 3）
- 超出后弹 `HintDialog`，让玩家选「金币」或「看广告」

### 6.7 HintCalculator.ts · 提示算法

- 从当前位置出发做 DFS，找到能走完所有未访问块的路径
- 返回路径的下一步
- 关卡数据已通过 `tools/level-validator.js` 预验证「至少有一条解」
- 性能：64 关里最大块数是终极全国 34 块，DFS 在毫秒内完成

## 7. 场景导航流

```
┌────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│ ① HomeScene│────▶│② ChapterScene│────▶│③ GameScene  │────▶│④ ResultScene │
│  主页       │     │ 章节+关卡列表  │     │ 关卡进行中    │     │  通关结算    │
└────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                            ▲                                         │
                            └─────────────（"返回章节" / "下一关"）─────┘
```

### 7.1 场景内嵌弹窗（不开新 Scene）

- **GameScene 内：**HintDialog / ResurrectDialog（触发广告位 ① ② ③）
- **ResultScene 内：**DoubleRewardDialog（触发广告位 ④）
- **HomeScene 内：**SignInDialog（v1.1 才加）

### 7.2 场景间数据传递

| From → To | 传递 | 方式 |
|---|---|---|
| Home → Chapter | chapterId | `director.loadScene + GlobalState` |
| Chapter → Game | levelId | `GlobalState.currentLevelId` |
| Game → Result | WinResult{stars, coins, time} | `GlobalState.lastWinResult` |
| Result → Chapter | 无 | SaveManager 已写入 |
| Result → Game (下一关) | nextLevelId | 同 Chapter→Game |

`GlobalState` 是约 30 行的轻量单例，不引第三方状态管理库。

### 7.3 性能保证

- **渲染：**地图色块用 `Graphics` 一次性绘制到 RenderTexture，标记块时只重绘单个块
- **命中判定：**SVG path 预转换为简化多边形（10-20 个顶点），ray casting 算法 O(n)，60 FPS 无压力
- **关卡加载：**切场景时 lazy require 单关 JSON
- **包体控制：**BGM OGG 压缩到 50KB/分钟以下，关卡 JSON 总大小预估 < 500KB

## 8. 抖音 SDK 集成

### 8.1 必需 / 建议 / 可选 API

| 能力 | API | MVP 必需 |
|---|---|---|
| 本地存储 | `tt.setStorageSync / getStorageSync` | ✅ 必需 |
| 激励视频 | `tt.createRewardedVideoAd` | ✅ 必需 |
| 登录（openid） | `tt.login` | 建议 |
| 用户信息 | `tt.getUserInfo` | 可选 |
| 分享 | `tt.shareAppMessage` | 建议（终极关炫耀） |
| 系统震动 | `tt.vibrateShort` | 建议（运笔反馈） |
| 游戏录屏 | `tt.getGameRecorderManager` | v1.1+ |
| 侧边栏跳转 | `tt.navigateToScene` | v1.1+ |
| 订阅消息 | `tt.subscribeAppMsg` | v1.1+ |

### 8.2 AdsManager 设计

```typescript
type AdSlot = 'resurrect' | 'hint' | 'undo' | 'doubleReward'

class AdsManager {
  private adInstances: Map<AdSlot, RewardedVideoAd> = new Map()

  init(): Promise<void>                              // 启动时预创建广告实例
  show(slot: AdSlot): Promise<AdResult>
    // 返回：{ success: true } 完整看完
    //      { success: false, reason: 'closed' | 'error' | 'no-ad' }
  reportEvent(slot: AdSlot, result: AdResult): void  // 上报本地统计
}

// 4 个广告位的统一调用入口
const adsMgr = AdsManager.instance
const result = await adsMgr.show('resurrect')
if (result.success) {
  tracker.rollback(3)
} else {
  showFallbackToast('广告未完成观看，请重试')
}
```

### 8.3 广告失败的回退策略（抖音审核硬要求）

> 必须为每个广告位设计「不看广告也能玩」的回退路径，否则会被审核拒绝。

| 广告位 | 看完 | 未看完/失败 | 不看（用金币） |
|---|---|---|---|
| ① 失败复活 | 撤回 3 步 | 提示重试或重玩 | 100 金币 |
| ② 提示 | 高亮下一步 | 提示重试 | 30 金币/次 |
| ③ 撤销 | 额外 3 次撤销 | 提示重试 | 10 金币/次 |
| ④ 双倍金币 | 金币 ×2 | 原金币入账 | N/A（白送的福利） |

广告超时（>10s 无响应）按"未看完"处理。

## 9. 关卡数据生产管线

```
① 原始 GeoJSON      ② 简化几何       ③ 计算邻接表      ④ 切割关卡
   阿里 DataV    →  topojson-simplify → adjacency-builder → geojson-to-levels
   ~5MB             每省 10-20 顶点    JSON 邻接 map      ~64 个 JSON
                                                              │
                                          ⑤ 可解性验证（DFS）  │
                                                  │             │
                                                  ▼             ▼
                                       ⑥ assets/resources/levels/
```

### 9.1 关卡切割策略

| tier | 关数 | 块数 | 切割方式 | 举例 |
|---|---|---|---|---|
| small | 30 | 3-5 | 大区随机抽相邻 3-5 省 | 京津冀、苏浙沪、湘鄂赣 |
| medium | 20 | 7-10 | 按地理大区 | 华东 7 省、东北+蒙、西南 5 省 |
| large | 10 | 15-20 | 两个大区合并 | 北方 15 省、南方 17 省 |
| ultimate | 4 | 34 | 全国 × 4 个不同起点 | 北京/海南/新疆/黑龙江出发 |

每个生成关卡都跑 DFS 验证至少有一条解；不可解则丢弃 + 重抽。

### 9.2 数据来源与合规

- **GeoJSON：** 阿里 DataV (`https://geo.datav.aliyun.com`) — 国家测绘局认证、含合规处理
- **合规要点：** 不可自行修改边界，台湾/南海等按官方表达
- **简化算法：** `topojson-simplify` 把每省顶点数从几千降到 10-20 个，包体压缩 95%+
- **邻接判断：** 两省边界 ring 共享至少 1 段公共线段视为邻接

## 10. 错误处理矩阵

| 场景 | 触发条件 | 处理策略 | 兜底体验 |
|---|---|---|---|
| 关卡 JSON 加载失败 | 资源损坏/网络异常 | retry 1 次 | 返回章节页可重试 |
| 广告 SDK 初始化失败 | SDK 错误/限流 | 静默 catch，按钮自动 fallback「用金币」 | 金币消费，不会卡住 |
| 广告播放失败 | 无库存/用户关闭 | 提示"未完整观看" | 可再试或用金币 |
| 本地存档损坏 | JSON 解析失败 | 备份到 `save.broken`，初始化新档 | 弹"存档恢复中"提示 |
| 存档版本升级 | v1 → v2 | `SaveManager.migrate()` 自动补默认值 | 玩家无感知 |
| 玩家中途退出后回归 | 杀进程/切后台 | 每次 visit 写 `save.partialPath`，回归弹"继续上次" | 2 步内进度无损恢复 |
| 音频加载失败 | 资源缺失/解码失败 | 静默 catch，游戏静音继续 | 不影响玩法 |
| 关卡不可解 | 脚本生成 bug | **构建期** validator 拦截 | 理论上不到运行时 |

## 11. 测试策略

### 11.1 单元测试（Jest，仅核心算法）

- `PathTracker`：visit / rollback / isValidNext / isComplete / isStuck — 全 case 覆盖
- `WinChecker`：星级评定的边界（恰好阈值 / 超出 1 / 超出大量）
- `HintCalculator`：DFS 在已知有解和无解的关卡上的行为
- `SaveManager.migrate()`：v1→v2 的字段填充
- **不测：** Cocos 渲染、抖音 SDK 调用（mock 成本太高，靠手测）

### 11.2 关卡数据测试（构建期 Node 脚本）

- `level-validator.js`：每个关卡 DFS 至少能找到 1 条解，否则构建失败
- 邻接表对称性检查（A 邻 B 则 B 必邻 A）
- 所有 `validStarts` 都能完整走完

### 11.3 端到端手测 checklist（每次提审前）

1. 主页 → 第 1 关 → 通关 → 看广告 → 双倍金币入账
2. 故意走错 → 卡死 → 复活弹窗 → 看广告 → 撤回 3 步
3. 用尽 3 次免费撤销 → 弹「金币 or 看广告」→ 两路径都试
4. 章节解锁规则（完成 15 个 small 关后 medium 解锁；完成 10 个 medium 后 large 解锁；完成 5 个 large 后 ultimate 解锁）
5. 游戏中切后台 → 30 秒后回 → 进度无损
6. 清空 storage → 重新进入 → 默认引导
7. 断网状态下 → 游戏可玩（除广告外）
8. 低端机（红米/iPhone 8）60 FPS 验证

## 12. 4 周开发时间线

### 第 1 周 · 基建 + 单关跑通

- **D1-2：** 注册抖音开发者账号、新建 GitHub 仓库、Cocos Creator 项目初始化、配抖音构建
- **D3-4：** 下载阿里 DataV GeoJSON、写 `tools/geojson-to-levels.js`（先做小关切割）、产出 5 个测试关卡
- **D5-6：** 实现 `MapRenderer` / `InputHandler` / `PathTracker` / `WinChecker`
- **D7：** 跑通完整 1 关：选起点 → 拖动一笔 → 通关 → console.log 星级
- **里程碑：** 抖音开发者工具能玩通 5 关

### 第 2 周 · 全部关卡 + 场景流

- **D8-9：** 完善关卡切割（4 tier），产出 64 关 JSON，跑可解性验证
- **D10-11：** 4 个 Scene、场景导航 + GlobalState
- **D12-13：** SaveManager（含 version migration）、章节解锁逻辑
- **D14：** 全流程跑通：开始 → 章节地图 → 选关 → 通关 → 解锁下一关
- **里程碑：** 不带广告/UI 美化的完整循环可玩

### 第 3 周 · 广告接入 + 美术 + 数值平衡

- **D15-16：** 抖音 SDK 集成、AdsManager、4 广告位接入 + 完整回退路径
- **D17-18：** 中国风水墨美化（SVG filter / 朱砂红 / 楷体 / 运笔轨迹）
- **D19-20：** UI 弹窗（Hint/Resurrect/DoubleReward）+ 章节卡片美化
- **D21：** 数值平衡 + 找朋友试玩 3-5 关收反馈
- **里程碑：** 视觉成品 + 完整变现回路

### 第 4 周 · 音效 + 上线 + 短视频

- **D22-23：** BGM（古琴 CC0）+ 音效（笔触/通关/失败/按钮）+ 震动反馈
- **D24：** 性能优化（包体压缩、纹理压缩、首屏 loading）+ 低端机测试
- **D25-26：** 提交抖音审核（首次 1-3 工作日，准备应对 2-3 轮驳回）
- **D27-28：** 同步剪 5-10 条短视频 + 注册抖音账号 + 发布
- **里程碑：** v1.0 上线 + 短视频矩阵启动

## 13. 风险清单

### 🔴 高风险

- **抖音审核拒绝（地图合规）**
  - 缓解：必须用国家测绘局认证的 DataV 数据，不可自行修改边界
- **水墨 SVG filter 性能**
  - 缓解：实现两套渲染路径——开发期用 SVG filter，构建时把每省份预渲染成 PNG 纹理

### 🟡 中风险

- **包体超 4MB**
  - 缓解：分包加载（首包仅主页 + 第一章前 5 关，其他章节走 subpackage 异步下载）
- **4 周可能超期**
  - 缓解：美术风格作为可降级项——若到第 3 周末 UI 还没好看，砍水墨改极简扁平，保上线时间

### 🟢 低风险

- **关卡可解性 bug**
  - 缓解：构建期 `level-validator.js` 强制 DFS 验证
- **数值平衡欠佳（前期太难/太易）**
  - 缓解：v1.0 用保守数值（偏简单），上线后调整

## 14. 上线前必跑 checklist

- [ ] 抖音开发者后台已完成主体认证、广告位 ID 已申请并配置
- [ ] 用真机（iOS + Android 各一台）跑完所有广告位的「看完」「中断」「失败」三路径
- [ ] 端到端手测 8 项全跑通
- [ ] 包体 < 4MB（首包），分包加载验证 OK
- [ ] 64 关全部 DFS 验证通过
- [ ] 隐私政策 + 用户协议 静态页面准备好（抖音审核要求）
- [ ] 小游戏图标、首屏图、推荐图按抖音规范出图
- [ ] 短视频账号已注册、已发 1-2 条预告视频

## 15. 后续版本预留（不在 MVP 范围）

- v1.1：游戏录屏分享、每日签到、跳关广告位、排行榜（如果数据上来）
- v1.2：第 2 章「世界国家」上线
- v1.3：第 3 章「城市地标」上线（需 AI 出图）
- v2.0：第 4 章「历史版图」+ 收集系统（省份徽章）

## 附：关键设计决策记录

| 决策 | 替代方案 | 选定理由 |
|---|---|---|
| 玩法 = 填色覆盖 | 沿边一笔画 / 节点串联 | 上手最低、关卡最多、广告位最多、最配「走遍」短视频主题 |
| 关卡 = 递进式 | 全国大关 / 纯小拼图 | 前 3 关劝退率最低、留存最高、广告触发最频繁、短视频素材丰富 |
| 美术 = 中国风水墨 | 极简 / 像素 / 手绘 | 抖音同类游戏占比仅 5%，差异化强，主题契合度高 |
| 架构 = 数据驱动单引擎 | 插件化 / 独立 Scene | 4 周可达性、扩展靠 JSON、避免过度设计 |
| 广告位 = 4 个 | 2 个极简 / 7 个全量 | 触发频次足够（11-27 次/天），不会让早期用户嫌烦 |
| MVP 仅第 1 章 | 4 章全做 | 4 周时间约束，架构上预留多章节扩展即可 |
