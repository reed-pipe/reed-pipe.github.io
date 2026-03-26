import { Skeleton } from 'antd'

/** 首页仪表板卡片骨架 */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{
          padding: 20,
          borderRadius: 16,
          background: 'var(--skeleton-bg, #f5f5f5)',
        }}>
          <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 2, width: ['80%', '60%'] }} />
        </div>
      ))}
    </div>
  )
}

/** 列表骨架（记账流水、体重列表等） */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 0',
          borderBottom: '1px solid var(--skeleton-border, #f0f0f0)',
        }}>
          <Skeleton.Avatar active size={40} shape="square" style={{ borderRadius: 10 }} />
          <div style={{ flex: 1 }}>
            <Skeleton active title={{ width: '30%' }} paragraph={{ rows: 1, width: ['50%'] }} />
          </div>
          <Skeleton.Button active size="small" style={{ width: 60 }} />
        </div>
      ))}
    </div>
  )
}

/** 图表区域骨架 */
export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div style={{
      height,
      borderRadius: 12,
      background: 'var(--skeleton-bg, #f5f5f5)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      padding: '20px 16px 16px',
      gap: 8,
    }}>
      {Array.from({ length: 7 }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${30 + Math.random() * 50}%`,
            borderRadius: 4,
            background: 'var(--skeleton-bar, #e8e8e8)',
            animation: 'skeleton-pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  )
}
