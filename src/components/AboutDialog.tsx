import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Info, ExternalLink } from "lucide-react"
import { useSettingStore } from "@/stores/setting"

export function AboutDialog() {
    const cairoVersion = useSettingStore(s => s.cairoVersion)
    return (
        <Dialog>
            <DialogTrigger asChild>
                <button className="p-1.5 hover:bg-accent rounded" title="About">
                    <Info size={14} />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>About Astro Editor</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm pt-2">
                    <p>
                        A cutting-edge, online IDE built on top of WASM-Cairo.
                        All-JavaScript-or-WASM environment, free of dependencies on backend servers and local setups.
                    </p>
                    <div>
                        <h3 className="font-medium flex items-center gap-1">
                            WASM-Cairo
                            <a href="https://wasm-cairo-landing.vercel.app/" target="_blank" rel="noreferrer" className="text-primary">
                                <ExternalLink size={12} />
                            </a>
                        </h3>
                        <p className="text-muted-foreground">A suite of development tools and environment for Cairo, all based on WebAssembly.</p>
                    </div>
                    <div>
                        <h3 className="font-medium">Author</h3>
                        <p className="text-muted-foreground">
                            <a href="https://twitter.com/cryptonerdcn" target="_blank" rel="noreferrer" className="text-primary hover:underline">cryptonerdcn</a>
                            {" from "}
                            <a href="https://twitter.com/starknetastrocn" target="_blank" rel="noreferrer" className="text-primary hover:underline">Starknet Astro</a>
                        </p>
                    </div>
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                        Cairo {cairoVersion} · Powered by wasm-cairo
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
