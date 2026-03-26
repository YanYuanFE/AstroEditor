import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useSettingStore } from "@/stores/setting"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Cog } from "lucide-react"

export function SettingsDialog() {
    const { isReplaceIds, availableGas, printFullMemory, useCairoDebugPrint, cairoVersion, setData } = useSettingStore()

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button className="p-1.5 hover:bg-accent rounded" title="Settings">
                    <Cog size={14} />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                    <div>
                        <div className="text-sm font-medium mb-3 text-muted-foreground">Compiler</div>
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <Checkbox
                                    checked={isReplaceIds}
                                    onCheckedChange={(v: boolean) => setData({ isReplaceIds: v })}
                                />
                                Replace ids
                            </label>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Cairo version:</span>
                                <span>{cairoVersion}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-medium mb-3 text-muted-foreground">VM</div>
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <Checkbox
                                    checked={printFullMemory}
                                    onCheckedChange={(v: boolean) => setData({ printFullMemory: v })}
                                />
                                Print full memory
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <Checkbox
                                    checked={useCairoDebugPrint}
                                    onCheckedChange={(v: boolean) => setData({ useCairoDebugPrint: v })}
                                />
                                Use Cairo DEBUG Print
                            </label>
                            <div className="flex items-center gap-2 text-sm">
                                <span>Available Gas:</span>
                                <Input
                                    type="number"
                                    className="w-24 h-8"
                                    value={availableGas}
                                    onChange={e => setData({ availableGas: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
