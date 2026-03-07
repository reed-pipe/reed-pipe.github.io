import { useState } from 'react'
import { Form, Input, Button, Typography, message, Segmented } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from './store'
import { colors, gradients, shadows } from '../theme'

const { Text } = Typography

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
        background: `linear-gradient(160deg, #FFF9F5 0%, #FFF1E8 30%, #EEF0FF 70%, #F5F5FA 100%)`,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative blurred circles */}
      <div style={{
        position: 'absolute', top: '10%', left: '15%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'rgba(245, 114, 45, 0.06)',
        filter: 'blur(80px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', right: '10%',
        width: 250, height: 250, borderRadius: '50%',
        background: 'rgba(37, 99, 235, 0.05)',
        filter: 'blur(60px)',
      }} />

      <div
        className="fade-in-up"
        style={{
          width: 400,
          maxWidth: '100%',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: `${shadows.lg}, inset 0 1px 0 rgba(255,255,255,0.9)`,
          padding: '40px 32px 32px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: gradients.primary,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
            boxShadow: shadows.primary,
          }}>
            <span style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>P</span>
          </div>
          <div style={{
            fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
            color: colors.text,
          }}>
            Personal Hub
          </div>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {mode === 'login' ? '登录以继续使用' : '创建一个新账户'}
          </Text>
        </div>

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
            <Input
              prefix={<UserOutlined style={{ color: colors.textTertiary }} />}
              placeholder="用户名"
              size="large"
              style={{ borderRadius: 12 }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '至少 6 个字符' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: colors.textTertiary }} />}
              placeholder="密码"
              size="large"
              style={{ borderRadius: 12 }}
            />
          </Form.Item>

          {mode === 'register' && (
            <Form.Item
              name="confirmPassword"
              rules={[{ required: true, message: '请确认密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: colors.textTertiary }} />}
                placeholder="确认密码"
                size="large"
                style={{ borderRadius: 12 }}
              />
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              style={{
                height: 46,
                borderRadius: 12,
                background: gradients.primary,
                border: 'none',
                fontWeight: 600,
                fontSize: 15,
                boxShadow: shadows.primary,
              }}
            >
              {mode === 'login' ? '登录' : '注册'}
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}
