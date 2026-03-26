import { openDB, IDBPDatabase } from 'idb'

const DB_NAME = 'astro-dep-cache'
const DB_VERSION = 1
const STORE_NAME = 'packages'

// Cache TTL: 7 days
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface CachedPackage {
    key: string              // "owner/repo#tag#packageName"
    name: string
    files: Record<string, string>
    scarbToml?: string
    workspaceEdition?: string
    cachedAt: number
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' })
                }
            },
        })
    }
    return dbPromise
}

export async function getCachedPackage(key: string): Promise<CachedPackage | null> {
    try {
        const db = await getDB()
        const entry = await db.get(STORE_NAME, key) as CachedPackage | undefined
        if (!entry) return null

        // Check if cache has expired
        if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
            await db.delete(STORE_NAME, key)
            return null
        }

        return entry
    } catch (err) {
        console.warn('[dep-cache] Failed to read cache:', err)
        return null
    }
}

export async function setCachedPackage(pkg: CachedPackage): Promise<void> {
    try {
        const db = await getDB()
        await db.put(STORE_NAME, pkg)
    } catch (err) {
        console.warn('[dep-cache] Failed to write cache:', err)
    }
}

export async function clearDependencyCache(): Promise<void> {
    try {
        const db = await getDB()
        await db.clear(STORE_NAME)
    } catch (err) {
        console.warn('[dep-cache] Failed to clear cache:', err)
    }
}

export async function getCacheSize(): Promise<number> {
    try {
        const db = await getDB()
        return await db.count(STORE_NAME)
    } catch (err) {
        console.warn('[dep-cache] Failed to get cache size:', err)
        return 0
    }
}
