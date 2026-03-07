import { useRef, useState, useCallback } from 'react'
import { Button, Modal, message, Spin } from 'antd'
import { ShareAltOutlined, DownloadOutlined } from '@ant-design/icons'
import type { Trip, TripSpot } from '@/shared/db'
import { tripDays, formatDateRange, formatCost, T } from '../utils'

interface Props {
  trip: Trip
  spots: TripSpot[]
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function generateCard(trip: Trip, spots: TripSpot[]): Promise<string> {
  const W = 750
  const dpr = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * dpr

  const days = tripDays(trip.startDate, trip.endDate)
  const photoCount = spots.reduce((n, s) => n + s.photos.length, 0)
  const spotCost = spots.reduce((s, sp) => s + (sp.cost ?? 0), 0)
  const totalCost = trip.totalCost ?? spotCost

  // Collect up to 6 photos
  const photos: string[] = []
  for (const s of spots) {
    for (const p of s.photos) {
      if (photos.length < 6) photos.push(p)
    }
  }

  // Calculate height
  let H = 0
  const coverH = trip.coverPhoto ? 320 : 0
  H += coverH > 0 ? coverH : 120 // header area
  H += 100 // title + info
  H += 80 // stats row
  if (photos.length > 0) H += 30 + (photos.length > 3 ? 260 : 130) // photo grid
  if (trip.summary) H += 100
  H += 80 // footer

  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
  bgGrad.addColorStop(0, '#FFF7ED')
  bgGrad.addColorStop(0.5, '#FFFFFF')
  bgGrad.addColorStop(1, '#FFF7ED')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, W, H)

  let y = 0

  // Cover photo
  if (trip.coverPhoto) {
    try {
      const img = await loadImage(trip.coverPhoto)
      const imgH = coverH
      ctx.save()
      drawRoundRect(ctx, 20, 20, W - 40, imgH, 20)
      ctx.clip()
      const scale = Math.max((W - 40) / img.width, imgH / img.height)
      const sw = img.width * scale
      const sh = img.height * scale
      ctx.drawImage(img, 20 + (W - 40 - sw) / 2, 20 + (imgH - sh) / 2, sw, sh)
      // Overlay gradient
      const grad = ctx.createLinearGradient(0, 20 + imgH - 120, 0, 20 + imgH)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, 'rgba(0,0,0,0.5)')
      ctx.fillStyle = grad
      ctx.fillRect(20, 20, W - 40, imgH)
      ctx.restore()
      y = 20 + imgH
    } catch {
      y = 20
    }
  } else {
    // Gradient header
    const grad = ctx.createLinearGradient(0, 0, W, 120)
    grad.addColorStop(0, '#F5722D')
    grad.addColorStop(1, '#FF9A5C')
    ctx.fillStyle = grad
    drawRoundRect(ctx, 20, 20, W - 40, 100, 20)
    ctx.fill()
    y = 120
  }

  // Title
  y += 24
  ctx.fillStyle = '#1a1a1a'
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  ctx.fillText(trip.title, 32, y)
  y += 10

  // Subtitle
  ctx.fillStyle = '#888'
  ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  ctx.fillText(`${trip.destination}  ·  ${formatDateRange(trip.startDate, trip.endDate)}`, 32, y + 20)
  y += 40

  // Rating
  if (trip.rating && trip.rating > 0) {
    ctx.fillStyle = '#faad14'
    ctx.font = '16px sans-serif'
    ctx.fillText('★'.repeat(trip.rating) + '☆'.repeat(5 - trip.rating), 32, y + 8)
    y += 20
  }

  // Stats row
  y += 20
  const statsData = [
    { label: '天数', value: `${days}`, unit: '天' },
    { label: '地点', value: `${spots.length}`, unit: '个' },
    { label: '照片', value: `${photoCount}`, unit: '张' },
    ...(totalCost > 0 ? [{ label: '花费', value: formatCost(totalCost), unit: '' }] : []),
  ]
  const statW = (W - 64 - (statsData.length - 1) * 12) / statsData.length
  statsData.forEach((stat, i) => {
    const sx = 32 + i * (statW + 12)
    // Glass card background
    ctx.fillStyle = 'rgba(245,114,45,0.06)'
    drawRoundRect(ctx, sx, y, statW, 52, 12)
    ctx.fill()
    // Label
    ctx.fillStyle = '#aaa'
    ctx.font = '11px -apple-system, sans-serif'
    ctx.fillText(stat.label, sx + 12, y + 18)
    // Value
    ctx.fillStyle = '#F5722D'
    ctx.font = 'bold 18px -apple-system, sans-serif'
    ctx.fillText(stat.value + stat.unit, sx + 12, y + 40)
  })
  y += 68

  // Photos grid
  if (photos.length > 0) {
    ctx.fillStyle = '#1a1a1a'
    ctx.font = 'bold 15px -apple-system, sans-serif'
    ctx.fillText('精选照片', 32, y + 4)
    y += 16

    const cols = Math.min(photos.length, 3)
    const rows = Math.ceil(photos.length / 3)
    const gap = 8
    const pw = (W - 64 - gap * (cols - 1)) / cols
    const ph = pw

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * 3 + c
        if (idx >= photos.length) break
        try {
          const img = await loadImage(photos[idx]!)
          const px = 32 + c * (pw + gap)
          const py = y + r * (ph + gap)
          ctx.save()
          drawRoundRect(ctx, px, py, pw, ph, 12)
          ctx.clip()
          const scale = Math.max(pw / img.width, ph / img.height)
          const sw = img.width * scale
          const sh = img.height * scale
          ctx.drawImage(img, px + (pw - sw) / 2, py + (ph - sh) / 2, sw, sh)
          ctx.restore()
        } catch { /* skip */ }
      }
    }
    y += rows * (ph + gap)
  }

  // Summary
  if (trip.summary) {
    y += 12
    ctx.fillStyle = 'rgba(245,114,45,0.06)'
    drawRoundRect(ctx, 32, y, W - 64, 72, 12)
    ctx.fill()
    // Left border accent
    ctx.fillStyle = '#F5722D'
    drawRoundRect(ctx, 32, y, 3, 72, 1.5)
    ctx.fill()
    ctx.fillStyle = '#666'
    ctx.font = 'italic 13px -apple-system, sans-serif'
    // Truncate
    const maxChars = 80
    const text = trip.summary.length > maxChars ? trip.summary.slice(0, maxChars) + '...' : trip.summary
    const lines = wrapText(ctx, text, W - 64 - 32)
    lines.slice(0, 3).forEach((line, i) => {
      ctx.fillText(line, 48, y + 22 + i * 18)
    })
  }

  // Footer
  ctx.fillStyle = '#ccc'
  ctx.font = '11px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Made with Travel Footprint', W / 2, H - 24)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/jpeg', 0.92)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const char of text) {
    if (char === '\n') { lines.push(line); line = ''; continue }
    const test = line + char
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = char }
    else line = test
  }
  if (line) lines.push(line)
  return lines
}

export default function ShareCard({ trip, spots }: Props) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setOpen(true)
    try {
      const url = await generateCard(trip, spots)
      setImageUrl(url)
    } catch {
      message.error('生成失败')
    } finally {
      setGenerating(false)
    }
  }, [trip, spots])

  const handleDownload = () => {
    if (!imageUrl) return
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = `${trip.title}_分享卡片.jpg`
    a.click()
    message.success('已保存到本地')
  }

  return (
    <>
      <Button
        type="text"
        icon={<ShareAltOutlined />}
        onClick={handleGenerate}
        style={{
          ...T.glassButton,
          color: T.primary,
          background: T.primaryBg,
          padding: '4px 10px', height: 'auto',
        }}
      />
      <Modal
        title="分享卡片"
        open={open}
        onCancel={() => { setOpen(false); setImageUrl(null) }}
        footer={imageUrl ? (
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload} block>
            保存图片
          </Button>
        ) : null}
        width={420}
      >
        {generating ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, color: '#999' }}>正在生成分享卡片...</div>
          </div>
        ) : imageUrl ? (
          <img
            ref={imgRef}
            src={imageUrl}
            alt="share"
            style={{ width: '100%', borderRadius: 12 }}
          />
        ) : null}
      </Modal>
    </>
  )
}
