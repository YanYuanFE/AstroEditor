/**
 * GitHub fetcher for Cairo package source code.
 *
 * Downloads Cairo packages from GitHub repositories, handling both
 * simple single-package repos and workspace monorepos (like OpenZeppelin).
 */

const GITHUB_API = 'https://api.github.com'
const GITHUB_RAW = 'https://raw.githubusercontent.com'

// Batch size for parallel file downloads to avoid overwhelming the browser/GitHub
const FETCH_BATCH_SIZE = 10

interface GitHubTreeEntry {
    path: string
    mode: string
    type: 'blob' | 'tree'
    sha: string
    size?: number
    url: string
}

interface GitHubTreeResponse {
    sha: string
    url: string
    tree: GitHubTreeEntry[]
    truncated: boolean
}

export interface FetchedPackage {
    files: Record<string, string>
    scarbToml?: string
    workspaceEdition?: string  // edition from workspace root [workspace.package]
}

/**
 * Parse a git URL into owner/repo.
 * Handles formats like:
 *   - https://github.com/OpenZeppelin/cairo-contracts.git
 *   - https://github.com/OpenZeppelin/cairo-contracts
 *   - git@github.com:OpenZeppelin/cairo-contracts.git
 */
function parseGitUrl(gitUrl: string): { owner: string; repo: string } {
    // HTTPS format
    let match = gitUrl.match(/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/)
    if (match) {
        return { owner: match[1], repo: match[2] }
    }

    // SSH format
    match = gitUrl.match(/github\.com:([^/]+)\/([^/.]+)(?:\.git)?/)
    if (match) {
        return { owner: match[1], repo: match[2] }
    }

    throw new Error(`Cannot parse GitHub URL: ${gitUrl}`)
}

/**
 * Fetch the full recursive file tree for a repo at a given ref (tag/branch/commit).
 */
async function fetchRepoTree(owner: string, repo: string, ref: string): Promise<GitHubTreeEntry[]> {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`
    const response = await fetch(url)

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Repository or ref not found: ${owner}/${repo}@${ref}`)
        }
        if (response.status === 403) {
            throw new Error(
                'GitHub API rate limit exceeded. Please wait a few minutes and try again, ' +
                'or use a smaller project.'
            )
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    const data: GitHubTreeResponse = await response.json()
    if (data.truncated) {
        console.warn('[github-fetcher] Tree response was truncated; some files may be missing.')
    }

    return data.tree
}

/**
 * Fetch the raw content of a file from GitHub.
 */
async function fetchFileContent(owner: string, repo: string, ref: string, path: string): Promise<string> {
    const url = `${GITHUB_RAW}/${owner}/${repo}/${ref}/${path}`
    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(`Failed to fetch ${path}: ${response.status}`)
    }

    return response.text()
}

/**
 * Download files in batches to avoid too many concurrent requests.
 */
async function batchFetchFiles(
    owner: string,
    repo: string,
    ref: string,
    paths: string[],
    onProgress?: (msg: string) => void,
): Promise<Record<string, string>> {
    const results: Record<string, string> = {}

    for (let i = 0; i < paths.length; i += FETCH_BATCH_SIZE) {
        const batch = paths.slice(i, i + FETCH_BATCH_SIZE)
        onProgress?.(`Downloading files ${i + 1}-${Math.min(i + FETCH_BATCH_SIZE, paths.length)} of ${paths.length}...`)

        const batchResults = await Promise.all(
            batch.map(async (path) => {
                try {
                    const content = await fetchFileContent(owner, repo, ref, path)
                    return { path, content }
                } catch (err) {
                    console.warn(`[github-fetcher] Failed to fetch ${path}:`, err)
                    return null
                }
            })
        )

        for (const result of batchResults) {
            if (result) {
                results[result.path] = result.content
            }
        }
    }

    return results
}

/**
 * Determine if a repo is a Scarb workspace by checking the root Scarb.toml.
 */
function isWorkspaceToml(content: string): boolean {
    return /\[workspace\]/.test(content)
}

/**
 * Find the directory containing a specific package in a workspace monorepo.
 * Looks for Scarb.toml files where [package] name matches the target package.
 */
async function findPackageDir(
    owner: string,
    repo: string,
    ref: string,
    tree: GitHubTreeEntry[],
    packageName: string,
): Promise<string | null> {
    // Find all Scarb.toml files (excluding root)
    const scarbFiles = tree
        .filter(e => e.type === 'blob' && e.path.endsWith('Scarb.toml') && e.path !== 'Scarb.toml')
        .map(e => e.path)

    // Try to guess the package directory first by common patterns
    // e.g. "openzeppelin_token" -> "packages/token/", "packages/openzeppelin_token/"
    const simpleName = packageName.replace(/^openzeppelin_/, '')
    const guesses = [
        `packages/${packageName}/Scarb.toml`,
        `packages/${simpleName}/Scarb.toml`,
        `crates/${packageName}/Scarb.toml`,
        `crates/${simpleName}/Scarb.toml`,
        `${packageName}/Scarb.toml`,
        `${simpleName}/Scarb.toml`,
    ]

    // Prioritize guesses
    const prioritized = [
        ...guesses.filter(g => scarbFiles.includes(g)),
        ...scarbFiles.filter(f => !guesses.includes(f)),
    ]

    // Check each Scarb.toml to find the one with matching package name
    for (const scarbPath of prioritized) {
        try {
            const content = await fetchFileContent(owner, repo, ref, scarbPath)
            const nameMatch = content.match(/\[package\][\s\S]*?name\s*=\s*"([^"]+)"/)
            if (nameMatch && nameMatch[1] === packageName) {
                // Return the directory containing this Scarb.toml
                return scarbPath.replace(/\/Scarb\.toml$/, '')
            }
        } catch {
            // Skip files we can't read
        }
    }

    return null
}

/**
 * Download a specific package from a GitHub repo.
 *
 * Handles both simple repos and workspace monorepos (like OpenZeppelin).
 * Returns the Cairo source files and the package's own Scarb.toml for
 * transitive dependency resolution.
 */
export async function fetchGitHubPackage(
    gitUrl: string,
    ref: string,
    packageName: string,
    onProgress?: (msg: string) => void,
): Promise<FetchedPackage> {
    const { owner, repo } = parseGitUrl(gitUrl)

    onProgress?.(`Fetching file tree for ${owner}/${repo}@${ref}...`)
    const tree = await fetchRepoTree(owner, repo, ref)

    // Determine the package root directory
    let packageRoot = ''
    let workspaceEdition: string | undefined

    // Check if this is a workspace
    const rootScarbEntry = tree.find(e => e.path === 'Scarb.toml' && e.type === 'blob')
    if (rootScarbEntry) {
        const rootScarbContent = await fetchFileContent(owner, repo, ref, 'Scarb.toml')

        if (isWorkspaceToml(rootScarbContent)) {
            onProgress?.(`Workspace detected. Searching for package "${packageName}"...`)

            // Extract workspace-level edition: [workspace.package] edition = "..."
            const wsEditionMatch = rootScarbContent.match(/\[workspace\.package\][\s\S]*?edition\s*=\s*"([^"]+)"/)
            if (wsEditionMatch) {
                workspaceEdition = wsEditionMatch[1]
            }

            const pkgDir = await findPackageDir(owner, repo, ref, tree, packageName)
            if (!pkgDir) {
                throw new Error(
                    `Package "${packageName}" not found in workspace ${owner}/${repo}@${ref}. ` +
                    `Check that the package name in Scarb.toml matches.`
                )
            }
            packageRoot = pkgDir
            onProgress?.(`Found package at ${packageRoot}/`)
        }
    }

    // Determine the src directory path
    const srcPrefix = packageRoot ? `${packageRoot}/src/` : 'src/'

    // Find all .cairo files under the package's src/ directory
    const cairoFiles = tree
        .filter(e => e.type === 'blob' && e.path.startsWith(srcPrefix) && e.path.endsWith('.cairo'))
        .map(e => e.path)

    if (cairoFiles.length === 0) {
        throw new Error(
            `No .cairo source files found under ${srcPrefix} in ${owner}/${repo}@${ref}. ` +
            `The package might have a different structure.`
        )
    }

    onProgress?.(`Found ${cairoFiles.length} Cairo source files for "${packageName}"`)

    // Also include the package's Scarb.toml for transitive dependency resolution
    const scarbTomlPath = packageRoot ? `${packageRoot}/Scarb.toml` : 'Scarb.toml'
    const filesToFetch = [...cairoFiles]
    const hasScarbToml = tree.some(e => e.path === scarbTomlPath && e.type === 'blob')
    if (hasScarbToml) {
        filesToFetch.push(scarbTomlPath)
    }

    // Download all files
    const rawFiles = await batchFetchFiles(owner, repo, ref, filesToFetch, onProgress)

    // Normalize file paths: strip the src prefix so paths are relative to crate root
    const files: Record<string, string> = {}
    let scarbToml: string | undefined

    for (const [path, content] of Object.entries(rawFiles)) {
        if (path === scarbTomlPath) {
            scarbToml = content
        } else if (path.startsWith(srcPrefix)) {
            // Strip src/ prefix: "packages/token/src/erc20.cairo" -> "erc20.cairo"
            const relativePath = path.slice(srcPrefix.length)
            files[relativePath] = content
        }
    }

    onProgress?.(`Downloaded ${Object.keys(files).length} files for "${packageName}"`)

    return { files, scarbToml, workspaceEdition }
}
