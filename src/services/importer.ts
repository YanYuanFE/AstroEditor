import JSZip from 'jszip'

export interface ImportResult {
    name: string
    files: Record<string, string>  // path -> content
}

// ========== Import from local directory ==========

export async function importFromDirectory(): Promise<ImportResult> {
    // @ts-ignore - showDirectoryPicker is not in all TS libs
    const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker()
    const name = dirHandle.name
    const files: Record<string, string> = {}

    await readDirectoryRecursive(dirHandle, '', files)
    return { name: detectProjectName(name, files), files }
}

async function readDirectoryRecursive(
    dirHandle: FileSystemDirectoryHandle,
    prefix: string,
    files: Record<string, string>,
) {
    for await (const entry of (dirHandle as any).values()) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name

        if (entry.kind === 'directory') {
            // Skip build artifacts and hidden directories
            if (['target', '.git', 'node_modules', '.idea', '.vscode'].includes(entry.name)) continue
            await readDirectoryRecursive(entry, path, files)
        } else if (entry.kind === 'file') {
            // Skip binary and non-text files
            if (/\.(wasm|png|jpg|jpeg|gif|svg|ico|lock|exe|dll|so|dylib)$/i.test(entry.name)) continue
            const file = await entry.getFile()
            const content = await file.text()
            files[path] = content
        }
    }
}

// ========== Import from zip file ==========

export async function importFromZip(file: File): Promise<ImportResult> {
    const zip = await JSZip.loadAsync(file)
    const files: Record<string, string> = {}

    // Detect if zip has a single root directory
    const rootPrefix = detectZipRootPrefix(zip)

    const promises: Promise<void>[] = []
    zip.forEach((relativePath, entry) => {
        if (entry.dir) return
        // Strip root prefix if exists
        let path = rootPrefix ? relativePath.replace(rootPrefix, '') : relativePath
        if (!path) return

        // Skip build artifacts and hidden directories
        if (path.startsWith('target/') || path.startsWith('.git/') || path.startsWith('node_modules/')) return
        // Skip binary files
        if (/\.(wasm|png|jpg|jpeg|gif|svg|ico|lock|exe|dll|so|dylib)$/i.test(path)) return

        promises.push(
            entry.async('string').then(content => {
                files[path] = content
            })
        )
    })

    await Promise.all(promises)

    const zipName = file.name.replace(/\.(zip|tar\.gz)$/i, '')
    return { name: detectProjectName(zipName, files), files }
}

function detectZipRootPrefix(zip: JSZip): string {
    const paths = Object.keys(zip.files)
    if (paths.length === 0) return ''

    const firstSegments = new Set(paths.map(p => p.split('/')[0]))
    if (firstSegments.size === 1) {
        const root = [...firstSegments][0]
        // Check if it's actually a directory
        if (zip.files[root + '/']) {
            return root + '/'
        }
    }
    return ''
}

// ========== Import from GitHub ==========

export async function importFromGitHub(repoInput: string): Promise<ImportResult> {
    // Parse "owner/repo" or "https://github.com/owner/repo"
    const match = repoInput.match(/(?:github\.com\/)?([^/]+\/[^/]+)\/?$/)
    if (!match) throw new Error('Invalid GitHub repository format. Use "owner/repo" or full GitHub URL.')

    const repo = match[1].replace(/\.git$/, '')

    // Use GitHub API to get the default branch tarball
    const apiUrl = `https://api.github.com/repos/${repo}/zipball`
    const response = await fetch(apiUrl)
    if (!response.ok) {
        if (response.status === 404) throw new Error(`Repository "${repo}" not found.`)
        throw new Error(`GitHub API error: ${response.status}`)
    }

    const blob = await response.blob()
    const file = new File([blob], `${repo.split('/')[1]}.zip`)
    return importFromZip(file)
}

// ========== Export to zip ==========

export async function exportToZip(
    projectName: string,
    files: Record<string, string>,
): Promise<Blob> {
    const zip = new JSZip()
    for (const [path, content] of Object.entries(files)) {
        zip.file(path, content)
    }
    return zip.generateAsync({ type: 'blob' })
}

// ========== Helpers ==========

function detectProjectName(fallbackName: string, files: Record<string, string>): string {
    // Try to detect project name from Scarb.toml
    const scarbContent = files['Scarb.toml']
    if (scarbContent) {
        const nameMatch = scarbContent.match(/name\s*=\s*"([^"]+)"/)
        if (nameMatch) return nameMatch[1]
    }
    return fallbackName
}

/**
 * Normalize imported files for storage in the project.
 * Keeps all files with their original paths intact.
 */
export function normalizeImportedFiles(files: Record<string, string>): Record<string, string> {
    return { ...files }
}

/**
 * Extract .cairo files for compilation, stripping src/ prefix if present.
 * The WASM API expects paths relative to the crate root (i.e. inside src/).
 */
export function extractCairoFilesForCompilation(files: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {}
    const hasSrcDir = Object.keys(files).some(p => p.startsWith('src/'))

    for (const [path, content] of Object.entries(files)) {
        if (!path.endsWith('.cairo')) continue

        if (hasSrcDir && path.startsWith('src/')) {
            result[path.slice(4)] = content
        } else if (!hasSrcDir) {
            result[path] = content
        }
    }

    return result
}
