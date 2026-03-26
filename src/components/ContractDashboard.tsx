import { useState } from 'react'
import { useContractStore } from '@/stores/contracts'
import { useDialogStore } from '@/stores/dialog'
import { useAccount, useConnect, useDisconnect } from '@starknet-react/core'
import { useStarknetkitConnectModal } from 'starknetkit'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { InteractPanel } from './deploy/InteractPanel'
import { getExplorerUrl, getExplorerContractUrl } from '@/utils/deploy'
import { displayTimeByTimeStamp } from '@/utils/common'
import type { Contract, NetworkId } from '@/types'
import { Copy, ExternalLink, Trash2, X, ChevronDown, ChevronRight, Unlink } from 'lucide-react'
import { toast } from 'sonner'

export function ContractDashboard({ onClose }: { onClose: () => void }) {
    const { account, address } = useAccount()
    const { connect, connectors } = useConnect()
    const { disconnect } = useDisconnect()
    const { starknetkitConnectModal } = useStarknetkitConnectModal({
        connectors: connectors as any,
    })

    const { contracts, selectedNetwork, removeContract, clearAllContracts } = useContractStore()
    const { confirm: showConfirm } = useDialogStore()
    const [expandedInteract, setExpandedInteract] = useState<string | null>(null)

    const contractEntries = Object.entries(contracts).reverse()

    const connectWallet = async () => {
        const { connector } = await starknetkitConnectModal()
        if (connector) {
            await connect({ connector: connector as any })
        }
    }

    const shortenHash = (h: string) =>
        h ? `${h.slice(0, 6)}...${h.slice(-4)}` : ''

    const copyText = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success('Copied')
    }

    const getStatus = (c: Partial<Contract>): string => {
        if ((c.deployedInfo || []).length > 0) return 'deployed'
        if ((c.declaredInfo || []).length > 0) return 'declared'
        return 'compiled'
    }

    const statusColor: Record<string, string> = {
        compiled: 'bg-status-compiled-bg text-status-compiled',
        declared: 'bg-status-declared-bg text-status-declared',
        deployed: 'bg-status-deployed-bg text-status-deployed',
    }

    return (
        <div className="w-[340px] shrink-0 border-l border-border flex flex-col bg-background h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contracts
                </span>
                <button className="p-1.5 rounded hover:bg-accent" onClick={onClose}>
                    <X size={14} />
                </button>
            </div>

            {/* Wallet */}
            <div className="px-3 py-2 border-b border-border">
                {address ? (
                    <div className="flex items-center gap-2">
                        <div className="flex-1 text-xs font-mono bg-secondary/50 rounded px-2 py-1 truncate">
                            {shortenHash(address)}
                        </div>
                        <button className="p-1 hover:bg-accent rounded" onClick={() => copyText(address)}>
                            <Copy size={12} />
                        </button>
                        <button className="p-1 hover:bg-accent rounded" onClick={() => disconnect()}>
                            <Unlink size={12} />
                        </button>
                    </div>
                ) : (
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={connectWallet}>
                        Connect Wallet
                    </Button>
                )}
            </div>

            <ScrollArea className="flex-1">
                <div className="p-3 space-y-3">
                    {contractEntries.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-8 text-center space-y-1">
                            <p>No contracts yet</p>
                            <p className="text-xs">Write a Starknet contract, then click <strong>Compile</strong> to get started.</p>
                        </div>
                    ) : (
                        contractEntries.map(([projectId, c]) => {
                            const status = getStatus(c)
                            const isInteracting = expandedInteract === projectId

                            // Find latest deployment for interact
                            const latestDeploy = (c.deployedInfo || []).at(-1)

                            return (
                                <div key={projectId} className="rounded border border-border overflow-hidden">
                                    {/* Card header */}
                                    <div className="px-3 py-2 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium truncate">{c.projectName || 'Unknown project'}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor[status]}`}>
                                                {status}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Contract: {c.name || 'Unknown'}
                                        </div>

                                        {/* Class Hash */}
                                        {c.classHash && (
                                            <div className="flex items-center gap-1 text-xs">
                                                <span className="text-muted-foreground">Class:</span>
                                                <span className="font-mono">{shortenHash(c.classHash)}</span>
                                                <button className="p-0.5 hover:bg-accent rounded" onClick={() => copyText(c.classHash!)}>
                                                    <Copy size={10} />
                                                </button>
                                            </div>
                                        )}

                                        {/* Compiled time */}
                                        {c.compiledAt && (
                                            <div className="text-[11px] text-muted-foreground">
                                                Compiled {displayTimeByTimeStamp(c.compiledAt)}
                                            </div>
                                        )}

                                        {/* Declare records */}
                                        {(c.declaredInfo || []).map((d, i) => (
                                            <div key={`decl-${i}`} className="flex items-center gap-1.5 text-xs">
                                                <span className="text-status-declared capitalize">{d.network}</span>
                                                <span className="text-muted-foreground">declared</span>
                                                {d.txHash && (
                                                    <a
                                                        href={getExplorerUrl(d.network, d.txHash)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-primary"
                                                    >
                                                        <ExternalLink size={10} />
                                                    </a>
                                                )}
                                            </div>
                                        ))}

                                        {/* Deploy records */}
                                        {(c.deployedInfo || []).map((d, i) => (
                                            <div key={`deploy-${i}`} className="flex items-center gap-1.5 text-xs">
                                                <span className="text-status-deployed capitalize">{d.network}</span>
                                                <span className="font-mono">{shortenHash(d.address)}</span>
                                                <button className="p-0.5 hover:bg-accent rounded" onClick={() => copyText(d.address)}>
                                                    <Copy size={10} />
                                                </button>
                                                <a
                                                    href={getExplorerContractUrl(d.network, d.address)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-primary"
                                                >
                                                    <ExternalLink size={10} />
                                                </a>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border bg-muted/30">
                                        {latestDeploy && c.abi && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[11px] px-2 gap-1"
                                                onClick={() => setExpandedInteract(isInteracting ? null : projectId)}
                                            >
                                                {isInteracting ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                Interact
                                            </Button>
                                        )}
                                        <div className="flex-1" />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-[11px] px-2 gap-1 text-destructive hover:text-destructive"
                                            onClick={async () => {
                                                if (await showConfirm(`Delete contract "${c.name || c.projectName || projectId}"?`)) {
                                                    removeContract(projectId)
                                                    if (expandedInteract === projectId) setExpandedInteract(null)
                                                }
                                            }}
                                        >
                                            <Trash2 size={11} /> Delete
                                        </Button>
                                    </div>

                                    {/* Interact panel (expanded) */}
                                    {isInteracting && latestDeploy && c.abi && (
                                        <div className="border-t border-border p-3">
                                            <div className="text-[11px] text-muted-foreground mb-2">
                                                {latestDeploy.network} / {shortenHash(latestDeploy.address)}
                                            </div>
                                            <InteractPanel
                                                abi={c.abi}
                                                contractAddress={latestDeploy.address}
                                                network={latestDeploy.network as NetworkId}
                                                account={account}
                                            />
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </ScrollArea>

            {/* Footer */}
            {contractEntries.length > 0 && (
                <div className="px-3 py-2 border-t border-border">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs text-destructive hover:text-destructive gap-1"
                        onClick={async () => {
                            if (await showConfirm('Clear all contract data?', 'This cannot be undone.')) {
                                clearAllContracts()
                                setExpandedInteract(null)
                            }
                        }}
                    >
                        <Trash2 size={12} /> Clear All
                    </Button>
                </div>
            )}
        </div>
    )
}
