import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from '@starknet-react/core'
import { useStarknetkitConnectModal } from 'starknetkit'
import { useContractStore } from '@/stores/contracts'
import { useProjectStore } from '@/stores/project'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConstructorForm } from './deploy/ConstructorForm'
import { InteractPanel } from './deploy/InteractPanel'
import {
    declareContract,
    deployContract,
    isClassDeclared,
    getRpcProvider,
    getExplorerUrl,
    getExplorerContractUrl,
} from '@/utils/deploy'
import { normalizeAbi, computeWalletClassHash } from '@/utils/starknet'
import type { NetworkId } from '@/types'
import { Check, Copy, ExternalLink, Unlink, X } from 'lucide-react'
import { toast } from 'sonner'

export const DeployPanel = ({ onClose }: { onClose?: () => void }) => {
    const { account, address } = useAccount()
    const { connect, connectors } = useConnect()
    const { disconnect } = useDisconnect()
    const { starknetkitConnectModal } = useStarknetkitConnectModal({
        connectors: connectors as any,
    })

    const connectWallet = async () => {
        const { connector } = await starknetkitConnectModal()
        if (connector) {
            await connect({ connector: connector as any })
        }
    }

    const {
        contracts,
        deployStep, setDeployStep,
        declaredClassHash, setDeclaredClassHash,
        deployedAddress, setDeployedAddress,
        selectedNetwork, setSelectedNetwork,
        resetDeploy,
        addDeclareInfo, addDeployInfo,
    } = useContractStore()
    const { currentProjectId, projects } = useProjectStore()

    const [isDeclaring, setIsDeclaring] = useState(false)
    const [isDeploying, setIsDeploying] = useState(false)
    const [declareTxHash, setDeclareTxHash] = useState('')
    const [deployTxHash, setDeployTxHash] = useState('')
    const [error, setError] = useState('')

    const currentProject = projects.find((project) => project.id === currentProjectId)
    const activeProjectId = currentProjectId || ''
    const contractData = activeProjectId ? contracts[activeProjectId] : null

    // Auto-check if class is already declared when contract data or network changes
    useEffect(() => {
        if (!contractData?.sierra || deployStep !== 'idle') return
        // sierra_program is stripped from persistence; skip if missing
        if (!contractData.sierra.sierra_program) return
        let cancelled = false

        const checkDeclared = async () => {
            try {
                const sierra = contractData.sierra!
                const abiArray = normalizeAbi(sierra.abi)
                const cleanSierra = {
                    sierra_program: sierra.sierra_program,
                    contract_class_version: sierra.contract_class_version,
                    entry_points_by_type: sierra.entry_points_by_type,
                    abi: abiArray,
                }
                const walletHash = computeWalletClassHash(cleanSierra, abiArray)

                const provider = getRpcProvider(selectedNetwork)
                const declared = await isClassDeclared(provider, walletHash)
                if (!cancelled && declared) {
                    setDeclaredClassHash(walletHash)
                    setDeployStep('declared')
                }
            } catch (e) {
                console.warn('[AstroEditor] Auto-check declare failed:', e)
            }
        }

        checkDeclared()
        return () => { cancelled = true }
    }, [contractData?.sierra, selectedNetwork])

    const shortenAddr = (addr: string) =>
        addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''

    const handleDeclare = async () => {
        if (!account || !contractData) return
        setError('')
        setIsDeclaring(true)

        console.log('[DeployPanel] handleDeclare contractData:', {
            name: contractData.name,
            hasSierra: !!contractData.sierra,
            hasCasm: !!contractData.casm,
            casmType: typeof contractData.casm,
            casmKeys: contractData.casm ? Object.keys(contractData.casm) : null,
            sierraKeys: contractData.sierra ? Object.keys(contractData.sierra) : null,
            classHash: contractData.classHash,
            compiledClassHash: contractData.compiledClassHash,
        })

        try {
            if (!contractData.casm) {
                setError('No CASM data. Recompile with a Starknet contract.')
                setIsDeclaring(false)
                return
            }

            setDeployStep('declaring')
            // declareContract internally normalizes ABI, computes correct classHash,
            // and checks isClassDeclared before calling the wallet.
            const result = await declareContract(account, contractData, selectedNetwork)
            setDeclaredClassHash(result.classHash)
            setDeclareTxHash(result.txHash)
            setDeployStep('declared')
            if (activeProjectId) {
                addDeclareInfo(activeProjectId, {
                    network: selectedNetwork,
                    classHash: result.classHash,
                    txHash: result.txHash,
                })
            }
            toast.success(result.alreadyDeclared ? 'Contract already declared' : 'Declare successful')
        } catch (err: any) {
            setError(err.message || String(err))
            setDeployStep('idle')
        } finally {
            setIsDeclaring(false)
        }
    }

    const handleDeploy = async (calldata: any[]) => {
        if (!account || !declaredClassHash) return
        setError('')
        setIsDeploying(true)

        try {
            setDeployStep('deploying')
            const result = await deployContract(account, declaredClassHash, calldata)
            setDeployedAddress(result.contractAddress)
            setDeployTxHash(result.txHash)
            setDeployStep('deployed')
            if (activeProjectId) {
                addDeployInfo(activeProjectId, {
                    network: selectedNetwork,
                    address: result.contractAddress,
                    txHash: result.txHash,
                })
            }
            toast.success('Deploy successful')
        } catch (err: any) {
            setError(err.message || String(err))
            setDeployStep('declared')
        } finally {
            setIsDeploying(false)
        }
    }

    return (
        <div className="w-[340px] shrink-0 border-l border-border flex flex-col bg-background h-full">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Deploy
                </span>
                {onClose && (
                    <button className="p-1.5 rounded hover:bg-accent" onClick={onClose}>
                        <X size={14} />
                    </button>
                )}
            </div>

            <ScrollArea className="flex-1">
                <div className="p-3 space-y-4">
                    {/* Wallet Connection */}
                    <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Wallet</div>
                        {address ? (
                            <div className="flex items-center gap-2">
                                <div className="flex-1 text-sm font-mono bg-secondary/50 rounded px-2 py-1.5 truncate">
                                    {shortenAddr(address)}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                        navigator.clipboard.writeText(address)
                                        toast.success('Address copied')
                                    }}
                                >
                                    <Copy size={14} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => disconnect()}
                                >
                                    <Unlink size={14} />
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={connectWallet}
                            >
                                Connect Wallet
                            </Button>
                        )}
                    </div>

                    {/* Network */}
                    <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Network</div>
                        <Select value={selectedNetwork} onValueChange={(v: string) => {
                            setSelectedNetwork(v as NetworkId)
                            resetDeploy()
                        }}>
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sepolia">Sepolia (Testnet)</SelectItem>
                                <SelectItem value="mainnet">Mainnet</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {!contractData ? (
                        <div className="text-sm text-muted-foreground py-4 text-center">
                            Compile the current project's Starknet contract first.
                        </div>
                    ) : (
                        <>
                            <div className="rounded border border-border p-3 space-y-1.5">
                                <div className="text-xs">
                                    <span className="text-muted-foreground">Project: </span>
                                    <span>{currentProject?.name || contractData.projectName || 'Unknown'}</span>
                                </div>
                                <div className="text-xs">
                                    <span className="text-muted-foreground">Contract: </span>
                                    <span>{contractData.name || 'Unknown'}</span>
                                </div>
                            </div>
                            {/* Step 1: Declare */}
                            <div className="space-y-2">
                                <div className="text-xs font-medium text-muted-foreground">
                                    1. Declare
                                </div>
                                <div className="rounded border border-border p-3 space-y-2">
                                    <div className="text-xs">
                                        <span className="text-muted-foreground">Class Hash: </span>
                                        <span className="font-mono break-all">
                                            {shortenAddr(contractData.classHash || '')}
                                        </span>
                                    </div>
                                    {deployStep === 'idle' || deployStep === 'declaring' ? (
                                        <Button
                                            onClick={handleDeclare}
                                            disabled={!address || isDeclaring}
                                            loading={isDeclaring}
                                            size="sm"
                                            className="w-full"
                                        >
                                            {!address ? 'Connect wallet first' : 'Declare'}
                                        </Button>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs text-status-success">
                                            <Check size={14} />
                                            Declared
                                            {declareTxHash && (
                                                <a
                                                    href={getExplorerUrl(selectedNetwork, declareTxHash)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-primary ml-1"
                                                >
                                                    <ExternalLink size={10} />
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Step 2: Deploy */}
                            {(deployStep === 'declared' || deployStep === 'deploying' || deployStep === 'deployed') && (
                                <div className="space-y-2">
                                    <div className="text-xs font-medium text-muted-foreground">
                                        2. Deploy
                                    </div>
                                    <div className="rounded border border-border p-3">
                                        {deployStep === 'deployed' ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-1.5 text-xs text-status-success">
                                                    <Check size={14} />
                                                    Deployed
                                                </div>
                                                <div className="flex items-center gap-1 text-xs font-mono">
                                                    <span className="break-all">{shortenAddr(deployedAddress)}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-5 w-5 p-0"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(deployedAddress)
                                                            toast.success('Address copied')
                                                        }}
                                                    >
                                                        <Copy size={10} />
                                                    </Button>
                                                    <a
                                                        href={getExplorerContractUrl(selectedNetwork, deployedAddress)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-primary"
                                                    >
                                                        <ExternalLink size={10} />
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <ConstructorForm
                                                abi={contractData.abi!}
                                                classHash={declaredClassHash}
                                                isDeploying={isDeploying}
                                                onDeploy={handleDeploy}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Interact */}
                            {deployStep === 'deployed' && contractData.abi && (
                                <div className="space-y-2">
                                    <div className="text-xs font-medium text-muted-foreground">
                                        3. Interact
                                    </div>
                                    <InteractPanel
                                        abi={contractData.abi}
                                        contractAddress={deployedAddress}
                                        network={selectedNetwork}
                                        account={account}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {/* Error display */}
                    {error && (
                        <div className="p-2 rounded bg-destructive/10 text-destructive text-xs break-all">
                            {error}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
