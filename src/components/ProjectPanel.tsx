import { useState, useRef } from 'react'
import {
    FilePlus, FolderPlus, Download, Upload, Github,
    Plus, Trash2, ChevronDown, PanelLeftClose, PanelLeft,
} from 'lucide-react'
import { useProjectStore } from '@/stores/project'
import { useDialogStore } from '@/stores/dialog'
import { FileTree } from './FileTree'
import { importFromDirectory, importFromZip, importFromGitHub, exportToZip, normalizeImportedFiles } from '@/services/importer'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SettingsDialog } from './SettingsDialog'
import { AboutDialog } from './AboutDialog'
import logo from '@/assets/logo.png'

export function ProjectPanel() {
    const {
        projects, currentProjectId, fileNodes,
        createProject, importProject, deleteProject, switchProject,
        createFile, createDirectory, getAllCairoFiles,
    } = useProjectStore()

    const [collapsed, setCollapsed] = useState(false)
    const [showNewProject, setShowNewProject] = useState(false)
    const [newProjectName, setNewProjectName] = useState('')
    const [showGitHubInput, setShowGitHubInput] = useState(false)
    const [githubUrl, setGithubUrl] = useState('')
    const [loading, setLoading] = useState(false)
    const zipInputRef = useRef<HTMLInputElement>(null)

    const { confirm: showConfirm, alert: showAlert, prompt: showPrompt } = useDialogStore()

    const currentProject = projects.find(p => p.id === currentProjectId)

    const handleCreateProject = async () => {
        const name = newProjectName.trim()
        if (!name) return
        await createProject(name)
        setNewProjectName('')
        setShowNewProject(false)
    }

    const handleImportDirectory = async () => {
        try {
            setLoading(true)
            const result = await importFromDirectory()
            const files = normalizeImportedFiles(result.files)
            await importProject(result.name, files)
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                console.error('Import failed:', e)
            }
        } finally {
            setLoading(false)
        }
    }

    const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
            setLoading(true)
            const result = await importFromZip(file)
            const files = normalizeImportedFiles(result.files)
            await importProject(result.name, files)
        } catch (err) {
            console.error('Import zip failed:', err)
        } finally {
            setLoading(false)
            e.target.value = ''
        }
    }

    const handleImportGitHub = async () => {
        const url = githubUrl.trim()
        if (!url) return
        try {
            setLoading(true)
            const result = await importFromGitHub(url)
            const files = normalizeImportedFiles(result.files)
            await importProject(result.name, files)
            setGithubUrl('')
            setShowGitHubInput(false)
        } catch (err: any) {
            console.error('GitHub import failed:', err)
            showAlert('Import Failed', err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleExport = async () => {
        if (!currentProject) return
        const files = getAllCairoFiles()
        const blob = await exportToZip(currentProject.name, files)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${currentProject.name}.zip`
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleNewFileAtRoot = async () => {
        const name = await showPrompt('File name:', 'new.cairo')
        if (!name) return
        const fileName = name.endsWith('.cairo') ? name : `${name}.cairo`
        await createFile('', fileName)
    }

    const handleNewFolderAtRoot = async () => {
        const name = await showPrompt('Folder name:')
        if (!name?.trim()) return
        await createDirectory('', name.trim())
    }

    if (collapsed) {
        return (
            <div className="w-10 border-r border-border flex flex-col items-center pt-2 shrink-0">
                <button
                    onClick={() => setCollapsed(false)}
                    className="p-1.5 hover:bg-accent rounded"
                    title="Expand panel"
                >
                    <PanelLeft size={16} />
                </button>
            </div>
        )
    }

    return (
        <div className="w-60 border-r border-border flex flex-col shrink-0 bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Explorer
                </span>
                <button
                    onClick={() => setCollapsed(true)}
                    className="p-1 hover:bg-accent rounded"
                    title="Collapse panel"
                >
                    <PanelLeftClose size={14} />
                </button>
            </div>

            {/* Project selector */}
            <div className="px-2 py-2 border-b border-border">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="w-full flex items-center justify-between px-2 py-1.5 text-sm bg-secondary/50 hover:bg-secondary rounded">
                            <span className="truncate">
                                {currentProject?.name || 'No project'}
                            </span>
                            <ChevronDown size={14} className="shrink-0 ml-1" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[calc(15rem-16px)] max-h-60 overflow-auto">
                        {projects.map(p => (
                            <DropdownMenuItem
                                key={p.id}
                                className={cn('group justify-between', p.id === currentProjectId && 'bg-accent')}
                                onSelect={() => switchProject(p.id)}
                            >
                                <span className="truncate flex-1">{p.name}</span>
                                <button
                                    className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-0.5 hover:text-destructive shrink-0"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={async () => {
                                        if (await showConfirm(`Delete project "${p.name}"?`)) {
                                            deleteProject(p.id)
                                        }
                                    }}
                                >
                                    <Trash2 size={12} />
                                </button>
                            </DropdownMenuItem>
                        ))}
                        {projects.length === 0 && (
                            <div className="px-2 py-2 text-sm text-muted-foreground">No projects</div>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Project actions */}
                <div className="flex gap-1 mt-2">
                    <button
                        onClick={() => setShowNewProject(true)}
                        className="flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1 bg-primary/10 hover:bg-primary/20 rounded"
                        title="New project"
                    >
                        <Plus size={12} /> New
                    </button>
                    <button
                        onClick={handleImportDirectory}
                        className="p-1 hover:bg-accent rounded"
                        title="Import folder"
                        disabled={loading}
                    >
                        <Upload size={14} />
                    </button>
                    <button
                        onClick={() => zipInputRef.current?.click()}
                        className="p-1 hover:bg-accent rounded"
                        title="Import zip"
                        disabled={loading}
                    >
                        <Download size={14} />
                    </button>
                    <button
                        onClick={() => setShowGitHubInput(!showGitHubInput)}
                        className="p-1 hover:bg-accent rounded"
                        title="Import from GitHub"
                        disabled={loading}
                    >
                        <Github size={14} />
                    </button>
                </div>
                <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={handleImportZip} />

                {/* New project input */}
                {showNewProject && (
                    <div className="mt-2 flex gap-1">
                        <input
                            className="flex-1 text-sm bg-background border border-border rounded px-2 py-1 outline-none focus:border-ring"
                            placeholder="Project name"
                            value={newProjectName}
                            onChange={e => setNewProjectName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleCreateProject()
                                if (e.key === 'Escape') setShowNewProject(false)
                            }}
                            autoFocus
                        />
                        <button onClick={handleCreateProject} className="text-xs px-2 bg-primary text-primary-foreground rounded">
                            OK
                        </button>
                    </div>
                )}

                {/* GitHub URL input */}
                {showGitHubInput && (
                    <div className="mt-2 flex gap-1">
                        <input
                            className="flex-1 text-sm bg-background border border-border rounded px-2 py-1 outline-none focus:border-ring"
                            placeholder="owner/repo"
                            value={githubUrl}
                            onChange={e => setGithubUrl(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleImportGitHub()
                                if (e.key === 'Escape') setShowGitHubInput(false)
                            }}
                            autoFocus
                        />
                        <button
                            onClick={handleImportGitHub}
                            className="text-xs px-2 bg-primary text-primary-foreground rounded"
                            disabled={loading}
                        >
                            {loading ? '...' : 'OK'}
                        </button>
                    </div>
                )}
            </div>

            {/* File tree toolbar */}
            {currentProject && (
                <div className="flex items-center gap-1 px-2 py-1 border-b border-border">
                    <span className="text-xs text-muted-foreground flex-1 truncate uppercase">
                        Files
                    </span>
                    <button onClick={handleNewFileAtRoot} className="p-1 hover:bg-accent rounded" title="New file">
                        <FilePlus size={14} />
                    </button>
                    <button onClick={handleNewFolderAtRoot} className="p-1 hover:bg-accent rounded" title="New folder">
                        <FolderPlus size={14} />
                    </button>
                    <button onClick={handleExport} className="p-1 hover:bg-accent rounded" title="Export as zip">
                        <Download size={14} />
                    </button>
                </div>
            )}

            {/* File tree */}
            <ScrollArea className="flex-1">
                {currentProject ? (
                    <FileTree />
                ) : (
                    <div className="px-3 py-4 text-sm text-muted-foreground">
                        Create or import a project to start.
                    </div>
                )}
            </ScrollArea>

            {loading && (
                <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
                    Importing...
                </div>
            )}

            {/* Bottom bar: logo + settings + about */}
            <div className="flex items-center justify-between px-2 py-2 border-t border-border">
                <a href="https://github.com/StarknetAstro/AstroEditor" target="_blank" rel="noreferrer">
                    <img src={logo} className="w-6 h-6 rounded" alt="Astro Editor" />
                </a>
                <div className="flex items-center gap-1">
                    <SettingsDialog />
                    <AboutDialog />
                </div>
            </div>
        </div>
    )
}
