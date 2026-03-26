import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    BugPlay,
    ChevronDown,
    ChevronUp,
    Copy,
    Eraser,
    FileDown,
    Hammer,
    LayoutList,
    Play,
    Rocket,
    Save,
    X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { checkIsContract, displayTimeByTimeStamp } from "@/utils/common";
import { useSettingStore } from "@/stores/setting";
import { useCairoWasm } from "@/hooks/useCairoWasm";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip } from "@/components/Tooltip";
import { useContractStore } from "@/stores/contracts";
import { genContractData } from "@/utils/starknet";
import { DeployPanel } from "@/components/DeployPanel";
import { ContractDashboard } from "@/components/ContractDashboard";
import { CairoEditor } from "@/components/Editor";
import { useProjectStore } from "@/stores/project";
import { ProjectPanel } from "@/components/ProjectPanel";
import { cn } from "@/lib/utils";
import { resolveProjectDependencies, type ResolvedDependency } from "@/services/dependency-resolver";

type RightPanel = 'none' | 'deploy' | 'dashboard';

export default function EditorPage() {
    const [rightPanel, setRightPanel] = useState<RightPanel>('none');
    const { isReplaceIds, availableGas, printFullMemory, useCairoDebugPrint } = useSettingStore();
    const [compileResult, setCompileResult] = useState<string>("");
    const [logs, setLogs] = useState<{ timestamp: number; message: string }[]>([]);
    const [outputCollapsed, setOutputCollapsed] = useState(false);

    const {
        compileCairo, compileContract, compileLoading,
        runCairo, runLoading,
        runTests, testLoading,
        compileCairoProject, runCairoProject, compileStarknetProject, runProjectTests,
        compileProjectLoading, runProjectLoading, testProjectLoading,
    } = useCairoWasm();

    const { setData: setContracts, removeContract } = useContractStore();

    const {
        initialized, init,
        currentProjectId, projects,
        openTabs, activeTabId,
        openFile, closeTab, setActiveTab,
        updateFileContent, getFileContent, getAllCairoFiles,
        getScarbTomlContent,
        saveAllFiles,
    } = useProjectStore();

    // Initialize project store
    useEffect(() => {
        init()
    }, [])

    const currentProject = projects.find(p => p.id === currentProjectId)

    // Get the content of the active file
    const activeContent = activeTabId ? getFileContent(activeTabId) : ''

    // Cache resolved dependencies so we don't re-resolve on every compile/run/test.
    // Invalidated when the Scarb.toml content changes.
    const resolvedDepsRef = useRef<{
        scarbHash: string
        deps: Record<string, ResolvedDependency>
    } | null>(null)
    const [resolvingDeps, setResolvingDeps] = useState(false)

    // Build project JSON for multi-file WASM APIs, optionally including resolved dependencies
    const buildProjectJson = (deps?: Record<string, ResolvedDependency>): string => {
        const files = getAllCairoFiles()
        const payload: any = {
            project_name: currentProject?.name || 'astro',
            files,
        }
        if (deps && Object.keys(deps).length > 0) {
            const dependencies: Record<string, any> = {}
            for (const [name, dep] of Object.entries(deps)) {
                dependencies[name] = {
                    files: dep.files,
                    edition: dep.edition,
                    dependencies: dep.dependencies,
                }
            }
            payload.dependencies = dependencies
        }
        return JSON.stringify(payload)
    }

    const MAX_LOGS = 200
    const addLog = (message: string) => {
        setLogs(prev => [{ timestamp: Date.now(), message }, ...prev].slice(0, MAX_LOGS))
    }

    /**
     * Resolve project dependencies if a Scarb.toml exists.
     * Returns resolved deps (may be empty) or null on error.
     * Uses an in-memory cache keyed by the Scarb.toml content.
     */
    const resolveDeps = async (): Promise<Record<string, ResolvedDependency>> => {
        const scarbToml = getScarbTomlContent()
        if (!scarbToml) return {}

        // Check in-memory cache
        const scarbHash = scarbToml
        if (resolvedDepsRef.current && resolvedDepsRef.current.scarbHash === scarbHash) {
            return resolvedDepsRef.current.deps
        }

        setResolvingDeps(true)
        addLog('Resolving project dependencies...')
        try {
            const deps = await resolveProjectDependencies(scarbToml, (msg) => {
                addLog(msg)
            })
            resolvedDepsRef.current = { scarbHash, deps }
            return deps
        } catch (err: any) {
            addLog(`Dependency resolution failed: ${err.message || err}`)
            return {}
        } finally {
            setResolvingDeps(false)
        }
    }

    // ========== Compile/Run/Test handlers ==========

    const handleCompile = async () => {
        if (!currentProjectId) return
        await saveAllFiles()

        try {
            // Resolve dependencies if Scarb.toml exists
            const deps = await resolveDeps()
            const projectJson = buildProjectJson(deps)
            const files = getAllCairoFiles()

            console.log('[Compile] projectJson:', projectJson)
            console.log('[Compile] deps:', deps)

            // Check if any file has a starknet contract
            const hasContract = Object.values(files).some(c => checkIsContract(c))

            let res: string
            if (hasContract) {
                console.log('[Compile] Compiling Starknet project...')
                res = await compileStarknetProject({
                    projectJson,
                    allowWarnings: true,
                    replaceIds: isReplaceIds,
                    outputCasm: true,
                }) as string
                console.log('[Compile] Starknet result:', res?.substring(0, 200))
                setCompileResult(res)
                addLog(res)

                // Try to generate contract data
                try {
                    const contractData = await genContractData(
                        currentProjectId,
                        currentProject?.name || 'project',
                        currentProject?.name || 'contract',
                        res,
                    )
                    console.log('[Compile] genContractData result:', {
                        isNull: contractData === null,
                        hasCasm: !!contractData?.casm,
                        casmKeys: contractData?.casm ? Object.keys(contractData.casm) : null,
                        hasSierra: !!contractData?.sierra,
                        sierraKeys: contractData?.sierra ? Object.keys(contractData.sierra) : null,
                            storeKey: currentProjectId,
                        })
                        if (contractData) {
                            setContracts({ [currentProjectId]: contractData })
                            // Verify store immediately after set
                            setTimeout(() => {
                            const stored = useContractStore.getState().contracts[currentProjectId]
                            console.log('[Compile] Store verification after setContracts:', {
                                hasCasm: !!stored?.casm,
                                sierraKeys: stored?.sierra ? Object.keys(stored.sierra) : null,
                            })
                        }, 100)
                    }
                } catch (e) {
                    console.error('[AstroEditor] genContractData failed:', e)
                }
            } else {
                console.log('[Compile] Compiling Cairo project...')
                removeContract(currentProjectId)
                res = await compileCairoProject({
                    projectJson,
                    replaceIds: isReplaceIds,
                }) as string
                console.log('[Compile] Cairo result:', res?.substring(0, 200))
                setCompileResult(res)
                addLog(res)
            }
        } catch (e: any) {
            console.error('[Compile] Full error:', e)
            addLog(`Compile error: ${e.message || e}\n${e.stack || ''}`)
        }
    }

    const handleRun = async () => {
        if (!currentProjectId) return
        await saveAllFiles()

        try {
            const deps = await resolveDeps()
            const projectJson = buildProjectJson(deps)
            console.log('[Run] projectJson:', projectJson)
            const gasValue = availableGas
            const res = await runCairoProject({
                projectJson,
                availableGas: gasValue === "" ? undefined : parseInt(gasValue),
                allowWarnings: true,
                printFullMemory: printFullMemory,
                useDBGPrintHint: useCairoDebugPrint,
                runProfiler: false,
            }) as string
            addLog(res)
        } catch (e: any) {
            console.error('[Run] Full error:', e)
            addLog(`Run error: ${e.message || e}\n${e.stack || ''}`)
        }
    }

    const handleRunTest = async () => {
        if (!currentProjectId) return
        await saveAllFiles()

        try {
            const deps = await resolveDeps()
            const projectJson = buildProjectJson(deps)
            console.log('[Test] projectJson:', projectJson)
            const res = await runProjectTests({
                projectJson,
                allowWarnings: true,
                filter: '',
                includeIgnored: true,
                ignored: true,
                starknet: false,
                gasDisabled: true,
                printResourceUsage: true,
            }) as string
            addLog(res)
        } catch (e: any) {
            console.error('[Test] Full error:', e)
            addLog(`Test error: ${e.message || e}\n${e.stack || ''}`)
        }
    }

    const handleSaveCompileResult = async () => {
        if (!compileResult) return
        try {
            let options: any = {
                suggestedName: 'astro_compiled.sierra',
                types: [{ description: 'Sierra File', accept: { 'text/plain': ['.sierra'] } }],
            }
            if (compileResult.includes("sierra_program")) {
                options = {
                    suggestedName: 'astro_compiled.json',
                    types: [{ description: 'JSON File', accept: { 'text/plain': ['.json'] } }],
                }
            }
            const fileHandle = await (window as any).showSaveFilePicker(options)
            const writable = await fileHandle.createWritable()
            await writable.write(compileResult)
            await writable.close()
        } catch {}
    }

    const isCompileLoading = compileLoading || compileProjectLoading || resolvingDeps
    const isRunLoading = runLoading || runProjectLoading
    const isTestLoading = testLoading || testProjectLoading

    return (
        <div className="flex h-full w-full relative">
            {/* Project Panel (file tree) */}
            <ProjectPanel />

            {/* Editor Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Tabs */}
                <div className="flex items-center border-b overflow-x-auto tab-scroll tab-fade">
                    {openTabs.map(tab => (
                        <div
                            key={tab.fileId}
                            className={cn(
                                "flex items-center gap-1 px-3 py-1.5 text-sm border-r cursor-pointer hover:bg-accent/50 shrink-0",
                                tab.fileId === activeTabId && "bg-accent text-accent-foreground",
                            )}
                            onClick={() => setActiveTab(tab.fileId)}
                            onMouseDown={(e) => {
                                // Middle click to close
                                if (e.button === 1) {
                                    e.preventDefault()
                                    closeTab(tab.fileId)
                                }
                            }}
                        >
                            <span className="truncate max-w-[140px]">
                                {tab.isDirty && <span className="text-primary mr-0.5">*</span>}
                                {tab.name}
                            </span>
                            <button
                                className="ml-1 p-0.5 rounded hover:bg-background/50"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    closeTab(tab.fileId)
                                }}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    {openTabs.length === 0 && (
                        <div className="px-4 py-2 text-sm text-muted-foreground">
                            Click a .cairo file in the Explorer to open it
                        </div>
                    )}
                </div>

                {/* Monaco Editor */}
                <div className="flex-1 min-h-0">
                    {activeTabId ? (
                        <CairoEditor
                            value={activeContent}
                            onChange={(v) => {
                                if (activeTabId) {
                                    updateFileContent(activeTabId, v || '')
                                }
                            }}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-1">
                            <span className="text-lg">
                                {currentProjectId ? "No file open" : "Welcome to Astro Editor"}
                            </span>
                            <span className="text-sm">
                                {currentProjectId
                                    ? "Click a file in the Explorer panel to start editing"
                                    : "Create a new project or import one from the Explorer panel"
                                }
                            </span>
                        </div>
                    )}
                </div>

                {/* Output Panel */}
                <div className="border-t">
                    {/* Header: OUTPUT label + actions + buttons */}
                    <div className="flex items-center gap-2 px-3 py-1.5">
                        <button
                            className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground"
                            onClick={() => setOutputCollapsed(!outputCollapsed)}
                        >
                            {outputCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            Output
                            {logs.length > 0 && (
                                <span className="text-[10px] font-normal ml-1 px-1 rounded bg-muted">{logs.length}</span>
                            )}
                        </button>
                        <div className="flex-1" />
                        <div className="flex items-center gap-1">
                            <Tooltip content="Copy output">
                                <button className="p-1 hover:bg-accent rounded" onClick={() => {
                                    const text = logs.map(l => `[${displayTimeByTimeStamp(l.timestamp)}] ${l.message}`).join('\n')
                                    navigator.clipboard.writeText(text)
                                    toast.success('Copied')
                                }}>
                                    <Copy size={14} />
                                </button>
                            </Tooltip>
                            <Tooltip content="Save compile result">
                                <button className="p-1 hover:bg-accent rounded" onClick={handleSaveCompileResult}>
                                    <Save size={14} />
                                </button>
                            </Tooltip>
                            <Tooltip content="Clear output">
                                <button className="p-1 hover:bg-accent rounded" onClick={() => setLogs([])}>
                                    <Eraser size={14} />
                                </button>
                            </Tooltip>
                        </div>
                        <div className="h-4 w-px bg-border mx-1" />
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" onClick={handleCompile} disabled={!currentProjectId} loading={isCompileLoading} size="sm" className="h-7 gap-1 text-xs px-2">
                                <Hammer size={13} /> Compile
                            </Button>
                            <Button variant="ghost" onClick={handleRun} disabled={!currentProjectId} loading={isRunLoading} size="sm" className="h-7 gap-1 text-xs px-2">
                                <Play size={13} /> Run
                            </Button>
                            <Button variant="ghost" onClick={handleRunTest} disabled={!currentProjectId} loading={isTestLoading} size="sm" className="h-7 gap-1 text-xs px-2">
                                <BugPlay size={13} /> Test
                            </Button>
                            <div className="h-4 w-px bg-border mx-0.5" />
                            <Button
                                variant={rightPanel === 'deploy' ? "secondary" : "ghost"}
                                onClick={() => setRightPanel(rightPanel === 'deploy' ? 'none' : 'deploy')}
                                size="sm"
                                className="h-7 gap-1 text-xs px-2"
                            >
                                <Rocket size={13} /> Deploy
                            </Button>
                            <Button
                                variant={rightPanel === 'dashboard' ? "secondary" : "ghost"}
                                onClick={() => setRightPanel(rightPanel === 'dashboard' ? 'none' : 'dashboard')}
                                size="sm"
                                className="h-7 gap-1 text-xs px-2"
                            >
                                <LayoutList size={13} /> Contracts
                            </Button>
                        </div>
                    </div>

                    {/* Collapsible log content */}
                    {!outputCollapsed && (
                        <ScrollArea className="h-[25vh]">
                            <div className="px-3 pb-3 space-y-2">
                                {logs.length === 0 ? (
                                    <div className="text-xs text-muted-foreground py-2">Click Compile, Run, or Test to see output here.</div>
                                ) : (
                                    logs.map((log, index) => (
                                        <div key={index} className="text-sm">
                                            <span className="text-xs text-muted-foreground">
                                                [{displayTimeByTimeStamp(log.timestamp)}]
                                            </span>
                                            <pre className="mt-0.5 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{log.message}</pre>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </div>

            {rightPanel !== 'none' && (
                <div className="max-lg:absolute max-lg:right-0 max-lg:top-0 max-lg:bottom-0 max-lg:z-40 max-lg:shadow-xl">
                    {rightPanel === 'deploy' && <DeployPanel onClose={() => setRightPanel('none')} />}
                    {rightPanel === 'dashboard' && <ContractDashboard onClose={() => setRightPanel('none')} />}
                </div>
            )}
        </div>
    )
}
