import { useState } from 'react'
import { Card, Form, Input, Button, Typography, message, Segmented } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from './store'

const { Title } = Typography

interface FormValues {
  username: string
  password: string
  confirmPassword?: string
}

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<FormValues>()
  const { login, register } = useAuthStore()

  const handleSubmit = async (values: FormValues) => {
    setLoading(true)
    try {
      if (mode === 'register') {
        if (values.password !== values.confirmPassword) {
          message.error('两次密码输入不一致')
          return
        }
        await register(values.username.trim(), values.password)
        message.success('注册成功')
      } else {
        await login(values.username.trim(), values.password)
        message.success('登录成功')
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
        padding: 16,
      }}
    >
      <Card style={{ width: 380, maxWidth: '100%' }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          个人助手
        </Title>

        <Segmented
          block
          value={mode}
          onChange={(v) => {
            setMode(v as 'login' | 'register')
            form.resetFields()
          }}
          options={[
            { label: '登录', value: 'login' },
            { label: '注册', value: 'register' },
          ]}
          style={{ marginBottom: 24 }}
        />

        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { pattern: /^[a-zA-Z0-9_-]+$/, message: '仅支持字母、数字、下划线、横线' },
              { min: 2, message: '至少 2 个字符' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '至少 6 个字符' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>

          {mode === 'register' && (
            <Form.Item
              name="confirmPassword"
              rules={[{ required: true, message: '请确认密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="确认密码"
                size="large"
              />
            </Form.Item>
          )}

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              {mode === 'login' ? '登录' : '注册'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
