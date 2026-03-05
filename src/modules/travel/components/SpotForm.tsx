import { useState } from 'react'
import { Modal, Form, Input, DatePicker, InputNumber, Upload, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import type { TripSpot } from '@/shared/db'
import { useDb } from '@/shared/db/context'
import { compressImage } from '../utils'

const { TextArea } = Input
const MAX_PHOTOS = 5

interface Props {
  open: boolean
  tripId: number
  tripStartDate: string
  tripEndDate: string
  spot?: TripSpot | null
  nextSortOrder: number
  onClose: () => void
  onSaved: () => void
}

export default function SpotForm({ open, tripId, tripStartDate, tripEndDate, spot, nextSortOrder, onClose, onSaved }: Props) {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const db = useDb()

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      if (spot) {
        form.setFieldsValue({
          name: spot.name,
          date: dayjs(spot.date),
          address: spot.address,
          lat: spot.lat,
          lng: spot.lng,
          cost: spot.cost,
          note: spot.note,
        })
        setPhotos(spot.photos ?? [])
      } else {
        form.resetFields()
        setPhotos([])
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
        address: values.address,
        lat: values.lat,
        lng: values.lng,
        photos,
        cost: values.cost,
        note: values.note,
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
      width={480}
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
        <Form.Item name="address" label="地址">
          <Input placeholder="详细地址（可选）" maxLength={100} />
        </Form.Item>
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="lat" label="纬度" style={{ flex: 1 }}>
            <InputNumber placeholder="可选" precision={6} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="lng" label="经度" style={{ flex: 1 }}>
            <InputNumber placeholder="可选" precision={6} style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <Form.Item name="cost" label="花费">
          <InputNumber prefix="¥" min={0} precision={0} style={{ width: '100%' }} placeholder="可选" />
        </Form.Item>
        <Form.Item label="照片">
          <Upload
            listType="picture-card"
            fileList={uploadFileList}
            beforeUpload={(file) => handlePhotoUpload(file as unknown as File)}
            onRemove={(file) => {
              const idx = parseInt(file.uid)
              setPhotos((prev) => prev.filter((_, i) => i !== idx))
            }}
            maxCount={MAX_PHOTOS}
            accept="image/*"
          >
            {photos.length < MAX_PHOTOS && (
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 8, fontSize: 12 }}>上传</div>
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
