import { getFunctionList } from '@/utils/deploy'
import { FunctionItem } from './FunctionItem'
import type { NetworkId } from '@/types'
import type { AccountInterface, Abi } from 'starknet'

interface InteractPanelProps {
    abi: Abi
    contractAddress: string
    network: NetworkId
    account?: AccountInterface
}

export function InteractPanel({ abi, contractAddress, network, account }: InteractPanelProps) {
    const functions = getFunctionList(abi)

    if (functions.length === 0) {
        return <div className="text-xs text-muted-foreground">No functions found in ABI.</div>
    }

    return (
        <div className="space-y-2">
            {functions.map((fn, i) => (
                <FunctionItem
                    key={i}
                    fn={fn}
                    abi={abi}
                    contractAddress={contractAddress}
                    network={network}
                    account={account}
                />
            ))}
        </div>
    )
}
