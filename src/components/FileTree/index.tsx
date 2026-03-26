import { useProjectStore } from '@/stores/project'
import { FileTreeNode } from './FileTreeNode'

export function FileTree() {
    const { fileNodes } = useProjectStore()

    // Get root-level nodes (parentPath === "")
    const rootNodes = fileNodes
        .filter(n => n.parentPath === '')
        .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
            return a.name.localeCompare(b.name)
        })

    if (rootNodes.length === 0) {
        return (
            <div className="px-3 py-4 text-sm text-muted-foreground">
                No files yet. Create a file to get started.
            </div>
        )
    }

    return (
        <div className="py-1">
            {rootNodes.map(node => (
                <FileTreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    allNodes={fileNodes}
                />
            ))}
        </div>
    )
}
