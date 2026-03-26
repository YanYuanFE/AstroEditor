import { useState, useRef } from 'react'
import {
    ChevronRight, ChevronDown, File, Folder, FolderOpen,
    Trash2, Pencil, FilePlus, FolderPlus, Copy,
} from 'lucide-react'
import type { FileNode } from '@/types'
import { useProjectStore } from '@/stores/project'
import { useDialogStore } from '@/stores/dialog'
import { cn } from '@/lib/utils'
import {
    ContextMenu, ContextMenuContent, ContextMenuItem,
    ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu'

interface Props {
    node: FileNode
    depth: number
    children?: FileNode[]
    allNodes: FileNode[]
}

export function FileTreeNode({ node, depth, allNodes }: Props) {
    const {
        expandedDirs, toggleDir, openFile, activeTabId,
        deleteNode, renameNode, createFile, createDirectory,
    } = useProjectStore()
    const { confirm: showConfirm } = useDialogStore()

    const [isRenaming, setIsRenaming] = useState(false)
    const [renameValue, setRenameValue] = useState(node.name)
    const [isCreating, setIsCreating] = useState<'file' | 'directory' | null>(null)
    const [createValue, setCreateValue] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const createInputRef = useRef<HTMLInputElement>(null)

    const isDir = node.type === 'directory'
    const isExpanded = expandedDirs.has(node.path)
    const isActive = activeTabId === node.id

    const children = allNodes
        .filter(n => n.parentPath === node.path)
        .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
            return a.name.localeCompare(b.name)
        })

    const handleClick = () => {
        if (isDir) {
            toggleDir(node.path)
        } else {
            openFile(node.id)
        }
    }

    const handleRenameSubmit = async () => {
        const trimmed = renameValue.trim()
        if (trimmed && trimmed !== node.name) {
            await renameNode(node.id, trimmed)
        }
        setIsRenaming(false)
    }

    const handleCreateSubmit = async () => {
        const trimmed = createValue.trim()
        if (trimmed && isCreating) {
            if (isCreating === 'file') {
                const name = trimmed.endsWith('.cairo') ? trimmed : `${trimmed}.cairo`
                await createFile(node.path, name)
            } else {
                await createDirectory(node.path, trimmed)
            }
        }
        setIsCreating(null)
        setCreateValue('')
    }

    const startCreate = (type: 'file' | 'directory') => {
        if (!isExpanded && isDir) toggleDir(node.path)
        setIsCreating(type)
        setCreateValue('')
        setTimeout(() => createInputRef.current?.focus(), 50)
    }

    const handleDelete = async () => {
        if (await showConfirm(`Delete "${node.name}"?`)) {
            deleteNode(node.id)
        }
    }

    // Drag & drop
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', node.id)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e: React.DragEvent) => {
        if (!isDir) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDrop = async (e: React.DragEvent) => {
        if (!isDir) return
        e.preventDefault()
        const dragId = e.dataTransfer.getData('text/plain')
        if (dragId && dragId !== node.id) {
            const { moveNode } = useProjectStore.getState()
            await moveNode(dragId, node.path)
        }
    }

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div
                        className={cn(
                            'flex items-center gap-1 px-2 py-[3px] cursor-pointer text-sm select-none hover:bg-accent/50 rounded-sm group',
                            isActive && !isDir && 'bg-accent text-accent-foreground',
                        )}
                        style={{ paddingLeft: `${depth * 16 + 8}px` }}
                        onClick={handleClick}
                        draggable
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        {isDir ? (
                            <span className="w-4 h-4 flex items-center justify-center shrink-0">
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                        ) : (
                            <span className="w-4 h-4 shrink-0" />
                        )}

                        <span className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground">
                            {isDir ? (
                                isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />
                            ) : (
                                <File size={14} />
                            )}
                        </span>

                        {isRenaming ? (
                            <input
                                ref={inputRef}
                                className="flex-1 bg-background border border-ring rounded px-1 text-sm outline-none"
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onBlur={handleRenameSubmit}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleRenameSubmit()
                                    if (e.key === 'Escape') setIsRenaming(false)
                                }}
                                onClick={e => e.stopPropagation()}
                                autoFocus
                            />
                        ) : (
                            <span className="truncate flex-1">{node.name}</span>
                        )}
                    </div>
                </ContextMenuTrigger>

                <ContextMenuContent className="min-w-[160px]">
                    {isDir && (
                        <>
                            <ContextMenuItem onSelect={() => startCreate('file')}>
                                <FilePlus size={14} className="mr-2" /> New File
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => startCreate('directory')}>
                                <FolderPlus size={14} className="mr-2" /> New Folder
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                        </>
                    )}
                    <ContextMenuItem onSelect={() => {
                        setRenameValue(node.name)
                        setIsRenaming(true)
                        setTimeout(() => inputRef.current?.focus(), 50)
                    }}>
                        <Pencil size={14} className="mr-2" /> Rename
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => navigator.clipboard.writeText(node.path)}>
                        <Copy size={14} className="mr-2" /> Copy Path
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem className="text-destructive focus:text-destructive" onSelect={handleDelete}>
                        <Trash2 size={14} className="mr-2" /> Delete
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>

            {/* Expanded children */}
            {isDir && isExpanded && (
                <>
                    {isCreating && (
                        <div
                            className="flex items-center gap-1 px-2 py-[3px]"
                            style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
                        >
                            <span className="w-4 h-4 shrink-0" />
                            <span className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground">
                                {isCreating === 'directory' ? <Folder size={14} /> : <File size={14} />}
                            </span>
                            <input
                                ref={createInputRef}
                                className="flex-1 bg-background border border-ring rounded px-1 text-sm outline-none"
                                value={createValue}
                                onChange={e => setCreateValue(e.target.value)}
                                onBlur={handleCreateSubmit}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleCreateSubmit()
                                    if (e.key === 'Escape') { setIsCreating(null); setCreateValue('') }
                                }}
                                placeholder={isCreating === 'file' ? 'filename.cairo' : 'folder name'}
                                autoFocus
                            />
                        </div>
                    )}
                    {children.map(child => (
                        <FileTreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            allNodes={allNodes}
                        />
                    ))}
                </>
            )}
        </>
    )
}
