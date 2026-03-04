const SERVICE_TOKEN = import.meta.env.VITE_SERVICE_TOKEN as string | undefined

const API = 'https://api.github.com'

function headers() {
  if (!SERVICE_TOKEN) throw new Error('VITE_SERVICE_TOKEN not configured')
  return {
    Authorization: `token ${SERVICE_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }
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
