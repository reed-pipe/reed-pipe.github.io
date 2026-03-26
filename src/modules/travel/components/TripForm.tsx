import { useState } from 'react'
import { Modal, Form, Input, DatePicker, InputNumber, Rate, Select, Upload, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import type { Trip } from '@/shared/db'
import { useDb } from '@/shared/db/context'
import { compressImage } from '../utils'
import LocationPicker, { type LocationValue } from './LocationPicker'

const { TextArea } = Input
const { RangePicker } = DatePicker

interface Props {
  open: boolean
  trip?: Trip | null
  onClose: () => void
  onSaved: () => void
}

const TAG_OPTIONS = ['自驾', '徒步', '出差', '亲子', '自由行', '跟团', '露营', '美食', '度假', '探险'].map((t) => ({
  label: t,
  value: t,
}))

export default function TripForm({ open, trip, onClose, onSaved }: Props) {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [coverPhoto, setCoverPhoto] = useState<string | undefined>(undefined)
  const [destination, setDestination] = useState<LocationValue | null>(null)
  const [departure, setDeparture] = useState<LocationValue | null>(null)
  const db = useDb()

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      if (trip) {
        form.setFieldsValue({
          title: trip.title,
          dateRange: [dayjs(trip.startDate), dayjs(trip.endDate)],
          tags: trip.tags,
          rating: trip.rating,
          totalCost: trip.totalCost,
          summary: trip.summary,
        })
        setCoverPhoto(trip.coverPhoto)
        setDestination(
          trip.lat != null && trip.lng != null
            ? { lat: trip.lat, lng: trip.lng, address: trip.destination }
            : null,
        )
        setDeparture(
          trip.departureLat != null && trip.departureLng != null
            ? { lat: trip.departureLat, lng: trip.departureLng, address: trip.departureName ?? '' }
            : null,
        )
      } else {
        form.resetFields()
        setCoverPhoto(undefined)
        setDestination(null)
        // 新建时加载默认出发地
        db.kv.get('default_departure').then((item) => {
          if (item?.value) {
            const val = item.value as { name: string; lat: number; lng: number }
            setDeparture({ lat: val.lat, lng: val.lng, address: val.name })
          }
        })
      }
    }
  }

  const handleCoverUpload = async (file: File) => {
    try {
      const compressed = await compressImage(file, 800, 0.7)
      setCoverPhoto(compressed)
    } catch {
      message.error('图片处理失败')
    }
    return false
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (!destination) {
      message.warning('请搜索并选择目的地')
      return
    }
    setSubmitting(true)
    try {
      const destName = destination.address.split(',')[0]?.trim() || destination.address
      const depName = departure?.address.split(',')[0]?.trim() || departure?.address

      const data = {
        title: values.title,
        destination: destName,
        lat: destination.lat,
        lng: destination.lng,
        departureName: depName,
        departureLat: departure?.lat,
        departureLng: departure?.lng,
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        tags: values.tags ?? [],
        rating: values.rating,
        totalCost: values.totalCost,
        summary: values.summary,
        coverPhoto,
      }

      if (trip) {
        await db.trips.update(trip.id, { ...data, updatedAt: Date.now() })
      } else {
        await db.trips.add({ ...data, createdAt: Date.now(), updatedAt: Date.now() } as never)
      }

      // 保存出发地为默认值
      if (departure) {
        await db.kv.put({
          key: 'default_departure',
          value: { name: departure.address, lat: departure.lat, lng: departure.lng },
        })
      }

      onSaved()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const uploadFileList: UploadFile[] = coverPhoto
    ? [{ uid: '-1', name: 'cover', status: 'done', url: coverPhoto }]
    : []

  return (
    <Modal
      title={trip ? '编辑旅行' : '新建旅行'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      afterOpenChange={handleOpen}
      width={520}
      destroyOnClose={false}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入旅行标题' }]}>
          <Input placeholder="例：日本关西之旅" maxLength={50} />
        </Form.Item>
        <Form.Item label="出发地">
          <LocationPicker
            value={departure}
            onChange={setDeparture}
            compact
            placeholder="搜索出发地（默认记住上次）"
          />
        </Form.Item>
        <Form.Item label="目的地" required>
          <LocationPicker
            value={destination}
            onChange={setDestination}
            placeholder="搜索目的地（如：大阪、巴黎、西湖）"
          />
        </Form.Item>
        <Form.Item name="dateRange" label="日期" rules={[{ required: true, message: '请选择日期范围' }]}>
          <RangePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="tags" label="标签">
          <Select mode="tags" placeholder="选择或输入标签" options={TAG_OPTIONS} />
        </Form.Item>
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="rating" label="评分" style={{ flex: 1 }}>
            <Rate />
          </Form.Item>
          <Form.Item name="totalCost" label="总花费" style={{ flex: 1 }}>
            <InputNumber prefix="¥" min={0} precision={0} style={{ width: '100%' }} placeholder="可选" />
          </Form.Item>
        </div>
        <Form.Item label="封面图片">
          <Upload
            listType="picture-card"
            fileList={uploadFileList}
            beforeUpload={() => false}
            openFileDialogOnClick={false}
            onRemove={() => setCoverPhoto(undefined)}
            maxCount={1}
          >
            {!coverPhoto && (
              <div style={{ position: 'relative' }}>
                <PlusOutlined />
                <div style={{ marginTop: 8, fontSize: 12 }}>上传封面</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) await handleCoverUpload(file)
                  }}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 1 }}
                />
              </div>
            )}
          </Upload>
        </Form.Item>
        <Form.Item name="summary" label="旅行感想">
          <TextArea rows={3} placeholder="记录一下这次旅行的感受..." maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  )
}
