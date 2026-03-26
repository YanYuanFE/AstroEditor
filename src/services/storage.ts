import { openDB, IDBPDatabase } from 'idb'
import type { Project, FileNode } from '@/types'

const DB_NAME = 'astro-editor-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('projects')) {
                    db.createObjectStore('projects', { keyPath: 'id' })
                }
                if (!db.objectStoreNames.contains('files')) {
                    const fileStore = db.createObjectStore('files', { keyPath: 'id' })
                    fileStore.createIndex('byProject', 'projectId')
                }
            },
        })
    }
    return dbPromise
}

// ========== Project Storage ==========

export const projectStorage = {
    async getAll(): Promise<Project[]> {
        const db = await getDB()
        return db.getAll('projects')
    },

    async get(id: string): Promise<Project | undefined> {
        const db = await getDB()
        return db.get('projects', id)
    },

    async save(project: Project): Promise<void> {
        const db = await getDB()
        await db.put('projects', project)
    },

    async delete(id: string): Promise<void> {
        const db = await getDB()
        await db.delete('projects', id)
    },
}

// ========== File Storage ==========

export const fileStorage = {
    async getByProject(projectId: string): Promise<FileNode[]> {
        const db = await getDB()
        return db.getAllFromIndex('files', 'byProject', projectId)
    },

    async get(id: string): Promise<FileNode | undefined> {
        const db = await getDB()
        return db.get('files', id)
    },

    async save(node: FileNode): Promise<void> {
        const db = await getDB()
        await db.put('files', node)
    },

    async saveBatch(nodes: FileNode[]): Promise<void> {
        const db = await getDB()
        const tx = db.transaction('files', 'readwrite')
        await Promise.all([
            ...nodes.map(node => tx.store.put(node)),
            tx.done,
        ])
    },

    async delete(id: string): Promise<void> {
        const db = await getDB()
        await db.delete('files', id)
    },

    async deleteBatch(ids: string[]): Promise<void> {
        const db = await getDB()
        const tx = db.transaction('files', 'readwrite')
        await Promise.all([
            ...ids.map(id => tx.store.delete(id)),
            tx.done,
        ])
    },

    async deleteByProject(projectId: string): Promise<void> {
        const db = await getDB()
        const files = await db.getAllFromIndex('files', 'byProject', projectId)
        const tx = db.transaction('files', 'readwrite')
        await Promise.all([
            ...files.map(f => tx.store.delete(f.id)),
            tx.done,
        ])
    },
}
