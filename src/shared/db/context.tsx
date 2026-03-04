import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { createDb, type AppDb } from './index'

const DbContext = createContext<AppDb | null>(null)

export function DbProvider({
  username,
  children,
}: {
  username: string
  children: ReactNode
}) {
  const db = useMemo(() => createDb(username), [username])
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>
}

export function useDb(): AppDb {
  const db = useContext(DbContext)
  if (!db) throw new Error('useDb must be used within DbProvider')
  return db
}
