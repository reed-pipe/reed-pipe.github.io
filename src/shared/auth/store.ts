import { create } from 'zustand'
import { deriveKey, generateSalt, createVerifier, checkVerifier } from './crypto'
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
  // listGists 不返回文件内容，需要单独获取
  return getGist(match.id)
}

async function loadRegistry(
  gist: GistInfo,
): Promise<Registry> {
  const file = gist.files[REGISTRY_FILENAME]
  if (!file) throw new Error('Registry file not found in gist')
  return JSON.parse(file.content) as Registry
}

export const useAuthStore = create<AuthState>((set, get) => ({
  username: null,
  isAdmin: false,
  cryptoKey: null,
  dataGistId: null,
  registryGistId: null,
  initialized: false,

  async init() {
    // Restore session if key is still in sessionStorage
    const saved = sessionStorage.getItem('pa_session')
    if (saved) {
      try {
        const { username, dataGistId, registryGistId } = JSON.parse(saved)
        // Key cannot be restored from sessionStorage (non-extractable CryptoKey)
        // User will need to re-login, but we keep username for display
        set({
          username,
          isAdmin: username === ADMIN_USERNAME,
          dataGistId,
          registryGistId,
          initialized: true,
          cryptoKey: null, // Will need re-auth for sync
        })
        return
      } catch {
        sessionStorage.removeItem('pa_session')
      }
    }
    set({ initialized: true })
  },

  async register(username: string, password: string) {
    if (!isServiceTokenAvailable()) {
      throw new Error('服务未配置，无法注册')
    }

    // Find or create registry
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

    // Derive key
    const salt = generateSalt()
    const key = await deriveKey(password, salt)
    const verifier = await createVerifier(key)

    // Create user data gist
    const dataGist = await createGist(
      `pa-data-${username}.json`,
      JSON.stringify({ syncVersion: 1, iv: '', data: '' }),
      `PA data for ${username}`,
    )

    // Update registry
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

    // Save session
    const session = {
      username,
      dataGistId: dataGist.id,
      registryGistId: registryGist.id,
    }
    sessionStorage.setItem('pa_session', JSON.stringify(session))

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

    // Save session
    const session = {
      username,
      dataGistId: user.dataGistId,
      registryGistId: registryGist.id,
    }
    sessionStorage.setItem('pa_session', JSON.stringify(session))

    set({
      username,
      isAdmin: username === ADMIN_USERNAME,
      cryptoKey: key,
      dataGistId: user.dataGistId,
      registryGistId: registryGist.id,
    })
  },

  logout() {
    sessionStorage.removeItem('pa_session')
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
