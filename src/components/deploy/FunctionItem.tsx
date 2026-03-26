import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isViewFunction, readContract, writeContract, getExplorerUrl } from '@/utils/deploy'
import { getRpcProvider } from '@/utils/deploy'
import type { AbiFunction } from '@/types'
import type { NetworkId } from '@/types'
import type { AccountInterface, Abi } from 'starknet'
import { ExternalLink } from 'lucide-react'

interface FunctionItemProps {
    fn: AbiFunction
    abi: Abi
    contractAddress: string
    network: NetworkId
    account?: AccountInterface
}

export function FunctionItem({ fn, abi, contractAddress, network, account }: FunctionItemProps) {
    const [values, setValues] = useState<Record<string, string>>({})
    const [result, setResult] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const isView = isViewFunction(fn)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setResult('')
        setLoading(true)

        try {
            const calldata = fn.inputs.map(input => values[input.name] ?? '')
            console.log('[AstroEditor] FunctionItem call:', {
                name: fn.name, isView, contractAddress,
                abiType: typeof abi, abiIsArray: Array.isArray(abi), abiLength: Array.isArray(abi) ? abi.length : 'N/A',
                calldata,
            })

            if (isView) {
                const provider = getRpcProvider(network)
                const res = await readContract(provider, contractAddress, abi, fn.name, calldata)
                setResult(res)
            } else {
                if (!account) {
                    setError('Please connect wallet first')
                    return
                }
                const res = await writeContract(account, contractAddress, abi, fn.name, calldata)
                setResult(res.txHash)
            }
        } catch (err: any) {
            console.error('[AstroEditor] FunctionItem error:', err)
            setError(err.message || String(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="rounded border border-border p-3">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">{fn.name}()</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isView ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                    {isView ? 'view' : 'write'}
                </span>
            </div>
            <form onSubmit={handleSubmit} className="space-y-2">
                {fn.inputs.map((input, i) => (
                    <div key={i}>
                        <label className="text-xs text-muted-foreground">
                            {input.name} ({input.type})
                        </label>
                        <Input
                            required
                            placeholder={input.name}
                            value={values[input.name] ?? ''}
                            onChange={e => setValues(prev => ({ ...prev, [input.name]: e.target.value }))}
                            className="h-7 text-xs mt-0.5"
                        />
                    </div>
                ))}
                <Button type="submit" size="sm" variant="outline" loading={loading} className="h-7 text-xs">
                    {isView ? 'Read' : 'Write'}
                </Button>
            </form>

            {result && (
                <div className="mt-2 p-2 rounded bg-muted text-xs font-mono break-all">
                    {!isView && result.startsWith('0x') ? (
                        <a
                            href={getExplorerUrl(network, result)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                            {result.slice(0, 10)}...{result.slice(-6)}
                            <ExternalLink size={10} />
                        </a>
                    ) : (
                        <pre className="whitespace-pre-wrap">{result}</pre>
                    )}
                </div>
            )}
            {error && (
                <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-xs break-all">
                    {error}
                </div>
            )}
        </div>
    )
}
