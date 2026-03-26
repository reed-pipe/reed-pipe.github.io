import { useState, useCallback } from 'react'
import { Modal, Upload, Table, Select, Button, Tag, message } from 'antd'
import { InboxOutlined } from '@ant-design/icons'

const { Dragger } = Upload

export interface FieldMapping {
  label: string
  key: string
  required?: boolean
}

export interface CsvImportResult {
  /** Parsed rows with mapped field names */
  rows: Record<string, string>[]
  /** Which rows conflict with existing data (indices) */
  conflictIndices: Set<number>
}

interface Props {
  open: boolean
  onClose: () => void
  fields: FieldMapping[]
  /** Check if a row conflicts with existing data. Return true if conflict. */
  checkConflict?: (row: Record<string, string>) => Promise<boolean>
  /** Called with the final imported rows */
  onImport: (rows: Record<string, string>[]) => Promise<void>
  title?: string
}

function detectEncoding(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  // Check for BOM
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return 'utf-8'
  // Simple GBK detection: look for bytes > 0x7F followed by valid GBK second byte
  let highByteCount = 0
  for (let i = 0; i < Math.min(bytes.length, 1000); i++) {
    if (bytes[i]! > 0x7F) highByteCount++
  }
  // If many high bytes and we can try GBK
  if (highByteCount > 10) {
    try {
      new TextDecoder('gbk').decode(buffer.slice(0, 100))
      return 'gbk'
    } catch { /* fallback */ }
  }
  return 'utf-8'
}

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  return lines.map(line => {
    const cols: string[] = []
    let inQuote = false
    let current = ''
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === ',' && !inQuote) { cols.push(current.trim()); current = ''; continue }
      current += ch
    }
    cols.push(current.trim())
    return cols
  })
}

function detectDateFormat(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'YYYY-MM-DD'
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(value)) return 'YYYY/MM/DD'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return 'MM/DD/YYYY'
  return null
}

function normalizeDate(value: string): string {
  const fmt = detectDateFormat(value)
  if (fmt === 'YYYY-MM-DD') return value
  if (fmt === 'YYYY/MM/DD') return value.replace(/\//g, '-')
  if (fmt === 'MM/DD/YYYY') {
    const [m, d, y] = value.split('/')
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  }
  return value
}

export default function CsvImporter({ open, onClose, fields, checkConflict, onImport, title = 'CSV 导入' }: Props) {
  const [csvData, setCsvData] = useState<string[][] | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [conflicts, setConflicts] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      message.error('文件大小不能超过 2MB')
      return false
    }
    const buffer = await file.arrayBuffer()
    const encoding = detectEncoding(buffer)
    const text = new TextDecoder(encoding).decode(buffer)
    const rows = parseCsv(text)
    if (rows.length < 2) {
      message.error('CSV 文件至少需要包含表头和一行数据')
      return false
    }
    setHeaders(rows[0]!)
    setCsvData(rows.slice(1))

    // Auto-map fields by name matching
    const autoMap: Record<string, number> = {}
    for (const field of fields) {
      const idx = rows[0]!.findIndex(h =>
        h.toLowerCase().includes(field.label.toLowerCase()) ||
        h.toLowerCase().includes(field.key.toLowerCase())
      )
      if (idx >= 0) autoMap[field.key] = idx
    }
    setMapping(autoMap)
    setConflicts(new Set())
    return false // prevent upload
  }, [fields])

  const handleCheckConflicts = useCallback(async () => {
    if (!csvData || !checkConflict) return
    const conflictSet = new Set<number>()
    for (let i = 0; i < csvData.length; i++) {
      const row: Record<string, string> = {}
      for (const field of fields) {
        const colIdx = mapping[field.key]
        if (colIdx !== undefined) {
          let val = csvData[i]![colIdx] ?? ''
          if (field.key === 'date') val = normalizeDate(val)
          row[field.key] = val
        }
      }
      if (await checkConflict(row)) conflictSet.add(i)
    }
    setConflicts(conflictSet)
  }, [csvData, checkConflict, fields, mapping])

  const handleImport = useCallback(async () => {
    if (!csvData) return
    const rows: Record<string, string>[] = []
    for (let i = 0; i < csvData.length; i++) {
      if (conflicts.has(i)) continue // skip conflicts
      const row: Record<string, string> = {}
      let valid = true
      for (const field of fields) {
        const colIdx = mapping[field.key]
        if (colIdx !== undefined) {
          let val = csvData[i]![colIdx] ?? ''
          if (field.key === 'date') val = normalizeDate(val)
          row[field.key] = val
        } else if (field.required) {
          valid = false
          break
        }
      }
      if (valid) rows.push(row)
    }
    setImporting(true)
    try {
      await onImport(rows)
      message.success(`成功导入 ${rows.length} 条记录`)
      handleClose()
    } catch (err) {
      message.error('导入失败')
    } finally {
      setImporting(false)
    }
  }, [csvData, conflicts, fields, mapping, onImport])

  const handleClose = () => {
    setCsvData(null)
    setHeaders([])
    setMapping({})
    setConflicts(new Set())
    onClose()
  }

  const requiredMapped = fields.filter(f => f.required).every(f => mapping[f.key] !== undefined)

  return (
    <Modal
      title={title}
      open={open}
      onCancel={handleClose}
      width={640}
      footer={csvData ? [
        <Button key="cancel" onClick={handleClose}>取消</Button>,
        checkConflict && <Button key="check" onClick={handleCheckConflicts}>检测冲突</Button>,
        <Button key="import" type="primary" onClick={handleImport} loading={importing} disabled={!requiredMapped}>
          导入 {csvData.length - conflicts.size} 条
        </Button>,
      ] : null}
      destroyOnClose
    >
      {!csvData ? (
        <Dragger
          accept=".csv"
          showUploadList={false}
          beforeUpload={handleFile}
          style={{ padding: 20 }}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p>点击或拖拽 CSV 文件到此处</p>
          <p style={{ fontSize: 12, color: '#999' }}>支持 UTF-8 和 GBK 编码，最大 2MB</p>
        </Dragger>
      ) : (
        <div>
          {/* Field mapping */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>字段映射</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {fields.map(field => (
                <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 13 }}>
                    {field.label}{field.required && <span style={{ color: 'red' }}>*</span>}:
                  </span>
                  <Select
                    size="small"
                    style={{ width: 120 }}
                    placeholder="选择列"
                    value={mapping[field.key]}
                    onChange={val => setMapping(prev => ({ ...prev, [field.key]: val }))}
                    allowClear
                    options={headers.map((h, i) => ({ label: h, value: i }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Preview table */}
          <Table
            size="small"
            dataSource={csvData.slice(0, 10).map((row, i) => ({ key: i, _idx: i, ...Object.fromEntries(row.map((v, j) => [j, v])) }))}
            columns={headers.map((h, i) => ({
              title: h,
              dataIndex: String(i),
              width: 100,
              ellipsis: true,
              render: (v: string, record: { _idx: number }) => (
                <span style={{ color: conflicts.has(record._idx) ? '#faad14' : undefined }}>
                  {v}
                  {conflicts.has(record._idx) && <Tag color="warning" style={{ marginLeft: 4, fontSize: 10 }}>冲突</Tag>}
                </span>
              ),
            }))}
            scroll={{ x: headers.length * 100 }}
            pagination={false}
            style={{ marginBottom: 8 }}
          />
          <div style={{ fontSize: 12, color: '#999' }}>
            共 {csvData.length} 行{conflicts.size > 0 && `，${conflicts.size} 行冲突将跳过`}
            {csvData.length > 10 && '（预览前 10 行）'}
          </div>
        </div>
      )}
    </Modal>
  )
}
