import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { Project, FileNode, OpenTab } from '@/types'
import { projectStorage, fileStorage } from '@/services/storage'

const DEFAULT_MAIN_CONTENT = `fn main() {
    println!("Hello, Cairo!");
}
`

interface ProjectState {
    // Projects
    projects: Project[]
    currentProjectId: string | null

    // File tree
    fileNodes: FileNode[]
    expandedDirs: Set<string>

    // Editor tabs
    openTabs: OpenTab[]
    activeTabId: string | null

    // Unsaved content buffer: fileId -> content (in-memory until save)
    dirtyContents: Record<string, string>

    // Initialization
    initialized: boolean
    init(): Promise<void>

    // Project operations
    createProject(name: string): Promise<string>
    importProject(name: string, files: Record<string, string>): Promise<string>
    deleteProject(id: string): Promise<void>
    switchProject(id: string): Promise<void>

    // File operations
    createFile(parentPath: string, name: string, content?: string): Promise<FileNode>
    createDirectory(parentPath: string, name: string): Promise<FileNode>
    renameNode(id: string, newName: string): Promise<void>
    deleteNode(id: string): Promise<void>
    moveNode(id: string, newParentPath: string): Promise<void>
    updateFileContent(id: string, content: string): void
    saveFile(id: string): Promise<void>
    saveAllFiles(): Promise<void>

    // Tab operations
    openFile(fileId: string): void
    closeTab(fileId: string): void
    setActiveTab(fileId: string): void

    // Tree UI
    toggleDir(path: string): void

    // Helpers
    getFileContent(fileId: string): string
    getAllCairoFiles(): Record<string, string>
    getScarbTomlContent(): string | null
}

export const useProjectStore = create<ProjectState>()(
    persist(
        (set, get) => ({
            projects: [],
            currentProjectId: null,
            fileNodes: [],
            expandedDirs: new Set<string>(),
            openTabs: [],
            activeTabId: null,
            dirtyContents: {},
            initialized: false,

            async init() {
                if (get().initialized) return
                const projects = await projectStorage.getAll()
                projects.sort((a, b) => b.updatedAt - a.updatedAt)

                set({ projects, initialized: true })

                const persistedProjectId = get().currentProjectId
                const initialProjectId = persistedProjectId && projects.some(p => p.id === persistedProjectId)
                    ? persistedProjectId
                    : projects[0]?.id ?? null

                if (initialProjectId) {
                    await get().switchProject(initialProjectId)
                } else if (persistedProjectId) {
                    set({ currentProjectId: null })
                }
            },

            // ========== Project operations ==========

            async createProject(name: string) {
                const project: Project = {
                    id: uuidv4(),
                    name,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                }
                await projectStorage.save(project)

                // Create default lib.cairo
                const libFile: FileNode = {
                    id: uuidv4(),
                    projectId: project.id,
                    name: 'lib.cairo',
                    path: 'lib.cairo',
                    type: 'file',
                    content: DEFAULT_MAIN_CONTENT,
                    parentPath: '',
                }
                await fileStorage.save(libFile)

                set(state => ({
                    projects: [project, ...state.projects],
                }))

                await get().switchProject(project.id)
                return project.id
            },

            async importProject(name: string, files: Record<string, string>) {
                const project: Project = {
                    id: uuidv4(),
                    name,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                }
                await projectStorage.save(project)

                const fileNodes: FileNode[] = []
                const dirs = new Set<string>()

                // Create directory nodes for all parent paths
                for (const filePath of Object.keys(files)) {
                    const parts = filePath.split('/')
                    for (let i = 1; i < parts.length; i++) {
                        const dirPath = parts.slice(0, i).join('/')
                        if (!dirs.has(dirPath)) {
                            dirs.add(dirPath)
                            fileNodes.push({
                                id: uuidv4(),
                                projectId: project.id,
                                name: parts[i - 1],
                                path: dirPath,
                                type: 'directory',
                                parentPath: parts.slice(0, i - 1).join('/') || '',
                            })
                        }
                    }
                }

                // Create file nodes
                for (const [filePath, content] of Object.entries(files)) {
                    const parts = filePath.split('/')
                    fileNodes.push({
                        id: uuidv4(),
                        projectId: project.id,
                        name: parts[parts.length - 1],
                        path: filePath,
                        type: 'file',
                        content,
                        parentPath: parts.slice(0, -1).join('/') || '',
                    })
                }

                await fileStorage.saveBatch(fileNodes)

                set(state => ({
                    projects: [project, ...state.projects],
                }))

                await get().switchProject(project.id)
                return project.id
            },

    async deleteProject(id: string) {
        await fileStorage.deleteByProject(id)
        await projectStorage.delete(id)

        const { currentProjectId, projects } = get()
        const remaining = projects.filter(p => p.id !== id)

        set({
            projects: remaining,
            ...(currentProjectId === id ? {
                currentProjectId: null,
                fileNodes: [],
                openTabs: [],
                activeTabId: null,
                dirtyContents: {},
                expandedDirs: new Set(),
            } : {}),
        })

        // Switch to another project if deleted the current one
        if (currentProjectId === id && remaining.length > 0) {
            await get().switchProject(remaining[0].id)
        }
    },

    async switchProject(id: string) {
        // Save dirty files of current project first
        await get().saveAllFiles()

        const fileNodes = await fileStorage.getByProject(id)

        // Auto-expand root directories
        const expandedDirs = new Set<string>()
        fileNodes.filter(n => n.type === 'directory' && n.parentPath === '').forEach(n => {
            expandedDirs.add(n.path)
        })

        // Auto-open lib.cairo
        const libFile = fileNodes.find(n => n.name === 'lib.cairo' && n.parentPath === '')
        const openTabs: OpenTab[] = []
        let activeTabId: string | null = null

        if (libFile) {
            openTabs.push({
                fileId: libFile.id,
                path: libFile.path,
                name: libFile.name,
                isDirty: false,
            })
            activeTabId = libFile.id
        }

        set({
            currentProjectId: id,
            fileNodes,
            expandedDirs,
            openTabs,
            activeTabId,
            dirtyContents: {},
        })
    },

    // ========== File operations ==========

    async createFile(parentPath: string, name: string, content = '') {
        const { currentProjectId, fileNodes } = get()
        if (!currentProjectId) throw new Error('No project selected')

        const path = parentPath ? `${parentPath}/${name}` : name
        const node: FileNode = {
            id: uuidv4(),
            projectId: currentProjectId,
            name,
            path,
            type: 'file',
            content,
            parentPath,
        }
        await fileStorage.save(node)

        set({ fileNodes: [...fileNodes, node] })
        get().openFile(node.id)
        return node
    },

    async createDirectory(parentPath: string, name: string) {
        const { currentProjectId, fileNodes } = get()
        if (!currentProjectId) throw new Error('No project selected')

        const path = parentPath ? `${parentPath}/${name}` : name
        const node: FileNode = {
            id: uuidv4(),
            projectId: currentProjectId,
            name,
            path,
            type: 'directory',
            parentPath,
        }
        await fileStorage.save(node)

        const expandedDirs = new Set(get().expandedDirs)
        expandedDirs.add(path)

        set({ fileNodes: [...fileNodes, node], expandedDirs })
        return node
    },

    async renameNode(id: string, newName: string) {
        const { fileNodes, openTabs, dirtyContents } = get()
        const node = fileNodes.find(n => n.id === id)
        if (!node) return

        const oldPath = node.path
        const newPath = node.parentPath ? `${node.parentPath}/${newName}` : newName

        // Update the node itself
        const updatedNode = { ...node, name: newName, path: newPath }
        await fileStorage.save(updatedNode)

        // Update all children if it's a directory
        const updatedNodes = fileNodes.map(n => {
            if (n.id === id) return updatedNode
            if (n.path.startsWith(oldPath + '/')) {
                const updated = {
                    ...n,
                    path: newPath + n.path.slice(oldPath.length),
                    parentPath: n.parentPath === oldPath
                        ? newPath
                        : newPath + n.parentPath.slice(oldPath.length),
                }
                fileStorage.save(updated)
                return updated
            }
            return n
        })

        // Update tabs
        const updatedTabs = openTabs.map(t => {
            const file = updatedNodes.find(n => n.id === t.fileId)
            if (file) return { ...t, path: file.path, name: file.name }
            return t
        })

        // Update expanded dirs
        const expandedDirs = new Set<string>()
        get().expandedDirs.forEach(d => {
            if (d === oldPath) expandedDirs.add(newPath)
            else if (d.startsWith(oldPath + '/')) expandedDirs.add(newPath + d.slice(oldPath.length))
            else expandedDirs.add(d)
        })

        set({ fileNodes: updatedNodes, openTabs: updatedTabs, expandedDirs })
    },

    async deleteNode(id: string) {
        const { fileNodes, openTabs, activeTabId, dirtyContents } = get()
        const node = fileNodes.find(n => n.id === id)
        if (!node) return

        // Collect all nodes to delete (node + descendants)
        const toDelete = fileNodes.filter(n =>
            n.id === id || n.path.startsWith(node.path + '/')
        )
        const deleteIds = new Set(toDelete.map(n => n.id))

        await fileStorage.deleteBatch([...deleteIds])

        const remainingNodes = fileNodes.filter(n => !deleteIds.has(n.id))
        const remainingTabs = openTabs.filter(t => !deleteIds.has(t.fileId))
        const newDirty = { ...dirtyContents }
        deleteIds.forEach(id => delete newDirty[id])

        let newActiveTab = activeTabId
        if (activeTabId && deleteIds.has(activeTabId)) {
            newActiveTab = remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1].fileId : null
        }

        set({
            fileNodes: remainingNodes,
            openTabs: remainingTabs,
            activeTabId: newActiveTab,
            dirtyContents: newDirty,
        })
    },

    async moveNode(id: string, newParentPath: string) {
        const { fileNodes } = get()
        const node = fileNodes.find(n => n.id === id)
        if (!node) return

        const oldPath = node.path
        const newPath = newParentPath ? `${newParentPath}/${node.name}` : node.name

        // Prevent moving into self
        if (newPath.startsWith(oldPath + '/')) return

        const updatedNodes = fileNodes.map(n => {
            if (n.id === id) {
                const updated = { ...n, path: newPath, parentPath: newParentPath }
                fileStorage.save(updated)
                return updated
            }
            if (n.path.startsWith(oldPath + '/')) {
                const updated = {
                    ...n,
                    path: newPath + n.path.slice(oldPath.length),
                    parentPath: n.parentPath === oldPath
                        ? newPath
                        : newPath + n.parentPath.slice(oldPath.length),
                }
                fileStorage.save(updated)
                return updated
            }
            return n
        })

        set({ fileNodes: updatedNodes })
    },

    updateFileContent(id: string, content: string) {
        const { openTabs, dirtyContents } = get()
        set({
            dirtyContents: { ...dirtyContents, [id]: content },
            openTabs: openTabs.map(t =>
                t.fileId === id ? { ...t, isDirty: true } : t
            ),
        })
    },

    async saveFile(id: string) {
        const { dirtyContents, fileNodes, openTabs } = get()
        const content = dirtyContents[id]
        if (content === undefined) return

        const node = fileNodes.find(n => n.id === id)
        if (!node) return

        const updated = { ...node, content }
        await fileStorage.save(updated)

        const newDirty = { ...dirtyContents }
        delete newDirty[id]

        set({
            fileNodes: fileNodes.map(n => n.id === id ? updated : n),
            dirtyContents: newDirty,
            openTabs: openTabs.map(t =>
                t.fileId === id ? { ...t, isDirty: false } : t
            ),
        })
    },

    async saveAllFiles() {
        const { dirtyContents } = get()
        const ids = Object.keys(dirtyContents)
        for (const id of ids) {
            await get().saveFile(id)
        }
    },

    // ========== Tab operations ==========

    openFile(fileId: string) {
        const { openTabs, fileNodes } = get()
        const existing = openTabs.find(t => t.fileId === fileId)
        if (existing) {
            set({ activeTabId: fileId })
            return
        }

        const node = fileNodes.find(n => n.id === fileId)
        if (!node || node.type !== 'file') return

        const tab: OpenTab = {
            fileId: node.id,
            path: node.path,
            name: node.name,
            isDirty: false,
        }
        set({
            openTabs: [...openTabs, tab],
            activeTabId: fileId,
        })
    },

    closeTab(fileId: string) {
        const { openTabs, activeTabId, dirtyContents } = get()
        const idx = openTabs.findIndex(t => t.fileId === fileId)
        if (idx === -1) return

        const remaining = openTabs.filter(t => t.fileId !== fileId)
        let newActive = activeTabId

        if (activeTabId === fileId) {
            if (remaining.length > 0) {
                // Activate the tab to the left, or the first one
                const newIdx = Math.min(idx, remaining.length - 1)
                newActive = remaining[newIdx].fileId
            } else {
                newActive = null
            }
        }

        const newDirty = { ...dirtyContents }
        delete newDirty[fileId]

        set({
            openTabs: remaining,
            activeTabId: newActive,
            dirtyContents: newDirty,
        })
    },

    setActiveTab(fileId: string) {
        set({ activeTabId: fileId })
    },

    // ========== Tree UI ==========

    toggleDir(path: string) {
        const expandedDirs = new Set(get().expandedDirs)
        if (expandedDirs.has(path)) {
            expandedDirs.delete(path)
        } else {
            expandedDirs.add(path)
        }
        set({ expandedDirs })
    },

    // ========== Helpers ==========

    getFileContent(fileId: string): string {
        const { dirtyContents, fileNodes } = get()
        if (fileId in dirtyContents) return dirtyContents[fileId]
        const node = fileNodes.find(n => n.id === fileId)
        return node?.content ?? ''
    },

    getAllCairoFiles(): Record<string, string> {
        const { fileNodes, dirtyContents } = get()
        const allFiles: Record<string, string> = {}
        for (const node of fileNodes) {
            if (node.type !== 'file' || !node.name.endsWith('.cairo')) continue
            allFiles[node.path] = dirtyContents[node.id] ?? node.content ?? ''
        }
        // Strip src/ prefix for WASM API (expects crate-root-relative paths)
        const hasSrcDir = Object.keys(allFiles).some(p => p.startsWith('src/'))
        if (!hasSrcDir) return allFiles

        const result: Record<string, string> = {}
        for (const [path, content] of Object.entries(allFiles)) {
            if (path.startsWith('src/')) {
                result[path.slice(4)] = content
            }
        }
        return result
    },

            getScarbTomlContent(): string | null {
                const { fileNodes, dirtyContents } = get()
                const node = fileNodes.find(n => n.type === 'file' && n.name === 'Scarb.toml' && n.parentPath === '')
                if (!node) return null
                return dirtyContents[node.id] ?? node.content ?? null
            },
        }),
        {
            name: 'astro-project-storage',
            partialize: (state) => ({
                currentProjectId: state.currentProjectId,
            }),
        },
    ),
)
