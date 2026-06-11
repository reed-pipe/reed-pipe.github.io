import { Space, Typography, Tabs, theme } from 'antd'
import { ClockCircleOutlined, SendOutlined, KeyOutlined } from '@ant-design/icons'
import PushTab from './components/PushTab'
import AuthKeyTab from './components/AuthKeyTab'

const { Text, Title } = Typography

export default function Watchface() {
  const { token: { colorPrimary } } = theme.useToken()

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          <ClockCircleOutlined style={{ color: colorPrimary, marginRight: 8 }} />
          手环表盘工具
        </Title>
        <Text type="secondary">本地直连小米手环 4，推送表盘 / 读取绑定密钥。纯本地操作，不需要登录、账号或联网。</Text>
      </div>

      <Tabs
        defaultActiveKey="push"
        items={[
          { key: 'push', label: <span><SendOutlined /> 推送表盘</span>, children: <PushTab /> },
          { key: 'authkey', label: <span><KeyOutlined /> 读取密钥</span>, children: <AuthKeyTab /> },
        ]}
      />
    </Space>
  )
}
