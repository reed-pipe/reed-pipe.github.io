const SERVICE_TOKEN = import.meta.env.VITE_SERVICE_TOKEN as string | undefined

const API = 'https://api.github.com'

function headers(): Record<string, string> {
  if (!SERVICE_TOKEN) throw new Error('VITE_SERVICE_TOKEN not configured')
  return {
    Authorization: `token ${SERVICE_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }
}

// --------------- ETag caching ---------------
const ETAG_KEY = 'pa_gist_etags'

function getStoredEtag(gistId: string): string | undefined {
  try {
    return JSON.parse(localStorage.getItem(ETAG_KEY) ?? '{}')[gistId]
  } catch { return undefined }
}

function storeEtag(gistId: string, etag: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(ETAG_KEY) ?? '{}')
    stored[gistId] = etag
    localStorage.setItem(ETAG_KEY, JSON.stringify(stored))
  } catch { /* ignore */ }
}

export interface GistFile {
  filename: string
  content: string
}

export interface GistInfo {
  id: string
  files: Record<string, { content: string }>
}

export function isServiceTokenAvailable(): boolean {
  return !!SERVICE_TOKEN
}

export async function listGists(): Promise<GistInfo[]> {
  const res = await fetch(`${API}/gists?per_page=100`, { headers: headers() })
  if (!res.ok) throw new Error(`List gists failed: ${res.status}`)
  return res.json()
}

export async function getGist(gistId: string): Promise<GistInfo> {
  const res = await fetch(`${API}/gists/${gistId}`, { headers: headers() })
  if (!res.ok) throw new Error(`Get gist failed: ${res.status}`)
  const etag = res.headers.get('etag')
  if (etag) storeEtag(gistId, etag)
  return res.json()
}

/** Conditional GET — returns null if the gist hasn't changed (HTTP 304). */
export async function getGistIfModified(gistId: string): Promise<GistInfo | null> {
  const etag = getStoredEtag(gistId)
  const hdrs = headers()
  if (etag) hdrs['If-None-Match'] = etag
  const res = await fetch(`${API}/gists/${gistId}`, { headers: hdrs })
  if (res.status === 304) return null
  if (!res.ok) throw new Error(`Get gist failed: ${res.status}`)
  const newEtag = res.headers.get('etag')
  if (newEtag) storeEtag(gistId, newEtag)
  return res.json()
}

export async function createGist(
  filename: string,
  content: string,
  description = '',
): Promise<GistInfo> {
  const res = await fetch(`${API}/gists`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      description,
      public: false,
      files: { [filename]: { content } },
    }),
  })
  if (!res.ok) throw new Error(`Create gist failed: ${res.status}`)
  return res.json()
}

export async function updateGist(
  gistId: string,
  filename: string,
  content: string,
): Promise<GistInfo> {
  const res = await fetch(`${API}/gists/${gistId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({
      files: { [filename]: { content } },
    }),
  })
  if (!res.ok) throw new Error(`Update gist failed: ${res.status}`)
  return res.json()
}

/** Update multiple files in one API call */
export async function updateGistFiles(
  gistId: string,
  files: Record<string, string>,
): Promise<GistInfo> {
  const body: Record<string, { content: string }> = {}
  for (const [name, content] of Object.entries(files)) {
    body[name] = { content }
  }
  const res = await fetch(`${API}/gists/${gistId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ files: body }),
  })
  if (!res.ok) throw new Error(`Update gist files failed: ${res.status}`)
  const etag = res.headers.get('etag')
  if (etag) storeEtag(gistId, etag)
  return res.json()
}
