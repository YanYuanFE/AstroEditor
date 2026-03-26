import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getConstructor } from '@/utils/deploy'
import type { Abi } from 'starknet'

interface ConstructorFormProps {
    abi: Abi
    classHash: string
    isDeploying: boolean
    onDeploy: (calldata: any[]) => void
}

export function ConstructorForm({ abi, classHash, isDeploying, onDeploy }: ConstructorFormProps) {
    const constructor = getConstructor(abi)
    const inputs = constructor?.inputs ?? []
    const [values, setValues] = useState<Record<string, string>>({})

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const calldata = inputs.map(input => values[input.name] ?? '')
        onDeploy(calldata)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            {inputs.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Constructor arguments</div>
                    {inputs.map((input, i) => (
                        <div key={i}>
                            <label className="text-xs">
                                <span className="font-medium">{input.name}</span>
                                <span className="text-muted-foreground ml-1">({input.type})</span>
                            </label>
                            <Input
                                required
                                placeholder={input.name}
                                value={values[input.name] ?? ''}
                                onChange={e => setValues(prev => ({ ...prev, [input.name]: e.target.value }))}
                                className="h-8 text-sm mt-1"
                            />
                        </div>
                    ))}
                </div>
            )}
            {inputs.length === 0 && (
                <div className="text-xs text-muted-foreground">No constructor arguments</div>
            )}
            <Button
                type="submit"
                disabled={!classHash || isDeploying}
                loading={isDeploying}
                size="sm"
                className="w-full"
            >
                Deploy
            </Button>
        </form>
    )
}
