import { useState } from 'react'
import { Modal, Form, Input, DatePicker, InputNumber, Upload, Select, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import type { TripSpot } from '@/shared/db'
import { useDb } from '@/shared/db/context'
import { compressImage, TRANSPORT_OPTIONS } from '../utils'
import LocationPicker, { type LocationValue } from './LocationPicker'

const { TextArea } = Input
const MAX_PHOTOS = 5

export interface SpotInitialData {
  name?: string
  location?: LocationValue
  photos?: string[]
  date?: string
}

interface Props {
  open: boolean
  tripId: number
  tripStartDate: string
  tripEndDate: string
  spot?: TripSpot | null
  nextSortOrder: number
  initialData?: SpotInitialData | null
  onClose: () => void
  onSaved: () => void
}

export default function SpotForm({ open, tripId, tripStartDate, tripEndDate, spot, nextSortOrder, initialData, onClose, onSaved }: Props) {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [location, setLocation] = useState<LocationValue | null>(null)
  const db = useDb()

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      if (spot) {
        form.setFieldsValue({
          name: spot.name,
          date: dayjs(spot.date),
          cost: spot.cost,
          note: spot.note,
          transport: spot.transport,
        })
        setPhotos(spot.photos ?? [])
        setLocation(
          spot.lat != null && spot.lng != null
            ? { lat: spot.lat, lng: spot.lng, address: spot.address ?? '' }
            : null,
        )
      } else {
        form.resetFields()
        // Pre-fill from initialData (quick check-in)
        if (initialData) {
          if (initialData.name) {
            form.setFieldValue('name', initialData.name)
          }
          if (initialData.date) {
            form.setFieldValue('date', dayjs(initialData.date))
          }
          setPhotos(initialData.photos ?? [])
          setLocation(initialData.location ?? null)
        } else {
          setPhotos([])
          setLocation(null)
        }
      }
    }
  }

  const handlePhotoUpload = async (file: File) => {
    if (photos.length >= MAX_PHOTOS) {
      message.warning(`最多上传 ${MAX_PHOTOS} 张图片`)
      return false
    }
    try {
      const compressed = await compressImage(file, 800, 0.7)
      setPhotos((prev) => [...prev, compressed])
    } catch {
      message.error('图片处理失败')
    }
    return false
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setSubmitting(true)
    try {
      const data = {
        tripId,
        name: values.name,
        date: values.date.format('YYYY-MM-DD'),
        address: location?.address,
        lat: location?.lat,
        lng: location?.lng,
        photos,
        cost: values.cost,
        note: values.note,
        transport: values.transport,
      }

      if (spot) {
        await db.tripSpots.update(spot.id, data)
      } else {
        await db.tripSpots.add({
          ...data,
          sortOrder: nextSortOrder,
          createdAt: Date.now(),
        } as never)
      }

      onSaved()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const uploadFileList: UploadFile[] = photos.map((p, i) => ({
    uid: String(i),
    name: `photo-${i}`,
    status: 'done' as const,
    url: p,
  }))

  return (
    <Modal
      title={spot ? '编辑地点' : '添加打卡点'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      afterOpenChange={handleOpen}
      width={520}
      destroyOnClose={false}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="地点名称" rules={[{ required: true, message: '请输入地点名称' }]}>
          <Input placeholder="例：道顿堀" maxLength={50} />
        </Form.Item>
        <Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期' }]}>
          <DatePicker
            style={{ width: '100%' }}
            disabledDate={(d) => d.isBefore(tripStartDate, 'day') || d.isAfter(tripEndDate, 'day')}
          />
        </Form.Item>
        <Form.Item name="transport" label="交通方式">
          <Select
            placeholder="到达此地的交通方式"
            allowClear
            options={TRANSPORT_OPTIONS.map((t) => ({ value: t.value, label: `${t.emoji} ${t.label}` }))}
          />
        </Form.Item>
        <Form.Item label="位置">
          <LocationPicker value={location} onChange={setLocation} />
        </Form.Item>
        <Form.Item name="cost" label="花费">
          <InputNumber prefix="¥" min={0} precision={0} style={{ width: '100%' }} placeholder="可选" />
        </Form.Item>
        <Form.Item label="照片">
          <Upload
            listType="picture-card"
            fileList={uploadFileList}
            beforeUpload={() => false}
            openFileDialogOnClick={false}
            onRemove={(file) => {
              const idx = parseInt(file.uid)
              setPhotos((prev) => prev.filter((_, i) => i !== idx))
            }}
            maxCount={MAX_PHOTOS}
          >
            {photos.length < MAX_PHOTOS && (
              <div style={{ position: 'relative' }}>
                <PlusOutlined />
                <div style={{ marginTop: 8, fontSize: 12 }}>上传</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) await handlePhotoUpload(file)
                  }}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 1 }}
                />
              </div>
            )}
          </Upload>
        </Form.Item>
        <Form.Item name="note" label="备注">
          <TextArea rows={2} placeholder="这个地方的体验..." maxLength={300} showCount />
        </Form.Item>
      </Form>
    </Modal>
  )
}
