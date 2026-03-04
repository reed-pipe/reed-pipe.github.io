import { create } from 'zustand'
import { deriveKey, generateSalt, createVerifier, checkVerifier, exportKey, importKey } from './crypto'
import {
  listGists,
  getGist,
  createGist,
  updateGist,
  isServiceTokenAvailable,
  type GistInfo,
} from '../sync/gist'

const REGISTRY_FILENAME = 'pa-registry.json'
const ADMIN_USERNAME = 'reed-pipe'
const SESSION_KEY = 'pa_session'

interface UserEntry {
  salt: string
  verifier: string
  dataGistId: string
  createdAt: number
  isAdmin?: boolean
}

interface Registry {
  version: number
  users: Record<string, UserEntry>
}

interface AuthState {
  username: string | null
  isAdmin: boolean
  cryptoKey: CryptoKey | null
  dataGistId: string | null
  registryGistId: string | null
  initialized: boolean

  init: () => Promise<void>
  register: (username: string, password: string) => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  getRegistry: () => Promise<Registry | null>
}

async function findRegistryGist(): Promise<GistInfo | null> {
  const gists = await listGists()
  const match = gists.find((g) => REGISTRY_FILENAME in g.files)
  if (!match) return null
  return getGist(match.id)
}

async function loadRegistry(
  gist: GistInfo,
): Promise<Registry> {
  const file = gist.files[REGISTRY_FILENAME]
  if (!file) throw new Error('Registry file not found in gist')
  return JSON.parse(file.content) as Registry
}

async function saveSession(
  username: string,
  dataGistId: string,
  registryGistId: string,
  key: CryptoKey,
) {
  const keyHex = await exportKey(key)
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    username,
    dataGistId,
    registryGistId,
    keyHex,
  }))
}

export const useAuthStore = create<AuthState>((set, get) => ({
  username: null,
  isAdmin: false,
  cryptoKey: null,
  dataGistId: null,
  registryGistId: null,
  initialized: false,

  async init() {
    const saved = localStorage.getItem(SESSION_KEY)
    if (saved) {
      try {
        const { username, dataGistId, registryGistId, keyHex } = JSON.parse(saved)
        const cryptoKey = keyHex ? await importKey(keyHex) : null
        set({
          username,
          isAdmin: username === ADMIN_USERNAME,
          cryptoKey,
          dataGistId,
          registryGistId,
          initialized: true,
        })
        return
      } catch {
        localStorage.removeItem(SESSION_KEY)
      }
    }
    set({ initialized: true })
  },

  async register(username: string, password: string) {
    if (!isServiceTokenAvailable()) {
      throw new Error('服务未配置，无法注册')
    }

    let registryGist = await findRegistryGist()
    let registry: Registry

    if (registryGist) {
      registry = await loadRegistry(registryGist)
    } else {
      registry = { version: 1, users: {} }
    }

    if (registry.users[username]) {
      throw new Error('用户名已存在')
    }

    const salt = generateSalt()
    const key = await deriveKey(password, salt)
    const verifier = await createVerifier(key)

    const dataGist = await createGist(
      `pa-data-${username}.json`,
      JSON.stringify({ syncVersion: 1, iv: '', data: '' }),
      `PA data for ${username}`,
    )

    registry.users[username] = {
      salt,
      verifier,
      dataGistId: dataGist.id,
      createdAt: Date.now(),
    }

    const registryContent = JSON.stringify(registry, null, 2)
    if (registryGist) {
      await updateGist(registryGist.id, REGISTRY_FILENAME, registryContent)
    } else {
      registryGist = await createGist(
        REGISTRY_FILENAME,
        registryContent,
        'PA User Registry',
      )
    }

    await saveSession(username, dataGist.id, registryGist.id, key)

    set({
      username,
      isAdmin: username === ADMIN_USERNAME,
      cryptoKey: key,
      dataGistId: dataGist.id,
      registryGistId: registryGist.id,
    })
  },

  async login(username: string, password: string) {
    if (!isServiceTokenAvailable()) {
      throw new Error('服务未配置，无法登录')
    }

    const registryGist = await findRegistryGist()
    if (!registryGist) {
      throw new Error('系统未初始化，请先注册')
    }

    const registry = await loadRegistry(registryGist)
    const user = registry.users[username]
    if (!user) {
      throw new Error('用户名或密码错误')
    }

    const key = await deriveKey(password, user.salt)
    const valid = await checkVerifier(user.verifier, key)
    if (!valid) {
      throw new Error('用户名或密码错误')
    }

    await saveSession(username, user.dataGistId, registryGist.id, key)

    set({
      username,
      isAdmin: username === ADMIN_USERNAME,
      cryptoKey: key,
      dataGistId: user.dataGistId,
      registryGistId: registryGist.id,
    })
  },

  logout() {
    localStorage.removeItem(SESSION_KEY)
    set({
      username: null,
      isAdmin: false,
      cryptoKey: null,
      dataGistId: null,
    })
  },

  async getRegistry() {
    const { registryGistId } = get()
    if (!registryGistId) return null
    const gist = await getGist(registryGistId)
    return loadRegistry(gist)
  },
}))
