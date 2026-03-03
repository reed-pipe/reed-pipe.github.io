import { Typography, Card, Space } from 'antd'
import { RocketOutlined } from '@ant-design/icons'

const { Title, Paragraph } = Typography

export default function Home() {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography>
        <Title level={2}>
          <RocketOutlined style={{ marginRight: 8 }} />
          欢迎使用个人助手
        </Title>
        <Paragraph>
          这是一个模块化的个人工具集，你可以通过左侧导航切换不同的功能模块。
        </Paragraph>
      </Typography>

      <Card title="快速开始" variant="borderless">
        <Paragraph>
          要添加新功能模块，只需：
        </Paragraph>
        <ol>
          <li>
            在 <code>src/modules/</code> 下新建目录
          </li>
          <li>
            创建 <code>index.tsx</code> 导出页面组件
          </li>
          <li>
            在 <code>src/router.tsx</code> 添加路由配置
          </li>
        </ol>
        <Paragraph>菜单会自动根据路由配置生成，无需手动修改布局。</Paragraph>
      </Card>
    </Space>
  )
}
