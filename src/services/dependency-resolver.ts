/**
 * Dependency resolver for Cairo projects in AstroEditor.
 *
 * Parses Scarb.toml files, resolves git dependencies by downloading
 * from GitHub, and caches results in IndexedDB.
 */

import { parse as parseToml } from 'smol-toml'
import { fetchGitHubPackage } from './github-fetcher'
import { getCachedPackage, setCachedPackage } from './dependency-cache'

// ========== Types ==========

export interface ScarbDependency {
    name: string
    version?: string
    git?: string
    tag?: string
    branch?: string
    path?: string  // workspace-internal
}

export interface ScarbPackageInfo {
    name: string
    version?: string
    edition?: string
}

export interface ResolvedDependency {
    name: string
    files: Record<string, string>  // path -> content
    edition?: string
    dependencies: string[]  // names of this dep's own dependencies
}

// Built-in dependencies that don't need downloading (handled by compiler)
const BUILTIN_DEPS = new Set(['starknet', 'core'])

// ========== Scarb.toml Parsing ==========

/**
 * Parse Scarb.toml content and extract package info + dependencies.
 *
 * Handles multiple dependency formats:
 *   dep = "version"            (version shorthand)
 *   dep = { version = "..." }  (version table)
 *   dep = { git = "...", tag = "..." }  (git dependency)
 *   dep = { path = "..." }     (local path, workspace-internal)
 */
export function parseScarbToml(content: string): {
    package: ScarbPackageInfo
    dependencies: Record<string, ScarbDependency>
} {
    let parsed: any
    try {
        parsed = parseToml(content)
    } catch (err: any) {
        throw new Error(`Failed to parse Scarb.toml: ${err.message || err}`)
    }

    // Extract package info
    const pkg = parsed.package || {}
    const packageInfo: ScarbPackageInfo = {
        name: pkg.name || 'unknown',
        version: pkg.version,
        edition: pkg.edition,
    }

    // Extract dependencies
    const dependencies: Record<string, ScarbDependency> = {}
    const rawDeps = parsed.dependencies || {}

    for (const [name, value] of Object.entries(rawDeps)) {
        if (typeof value === 'string') {
            // Shorthand: dep = "version"
            dependencies[name] = {
                name,
                version: value,
            }
        } else if (typeof value === 'object' && value !== null) {
            const v = value as Record<string, any>
            dependencies[name] = {
                name,
                version: v.version,
                git: v.git,
                tag: v.tag,
                branch: v.branch,
                path: v.path,
            }
        }
    }

    return { package: packageInfo, dependencies }
}

// ========== Cache Key Generation ==========

/**
 * Generate a cache key for a git dependency.
 * Format: "owner/repo#ref#packageName"
 */
function makeCacheKey(gitUrl: string, ref: string, packageName: string): string {
    const match = gitUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/)
    const repoId = match ? `${match[1]}/${match[2]}` : gitUrl
    return `${repoId}#${ref}#${packageName}`
}

// ========== Main Resolver ==========

/**
 * Resolve all dependencies for a project given its Scarb.toml content.
 *
 * 1. Parses the Scarb.toml
 * 2. Filters out built-in deps (starknet, core)
 * 3. For each git dependency, checks IndexedDB cache first
 * 4. If not cached, downloads from GitHub
 * 5. Recursively resolves transitive dependencies
 * 6. Returns all resolved dependencies
 */
export async function resolveProjectDependencies(
    scarbTomlContent: string,
    onProgress?: (msg: string) => void,
): Promise<Record<string, ResolvedDependency>> {
    const { package: rootPkg, dependencies } = parseScarbToml(scarbTomlContent)
    const resolved: Record<string, ResolvedDependency> = {}

    // Queue of dependencies to resolve: [name, dep-info, from-which-package]
    const queue: Array<{ name: string; dep: ScarbDependency; parentGit?: string; parentRef?: string }> = []

    // Seed the queue with root-level dependencies
    for (const [name, dep] of Object.entries(dependencies)) {
        if (BUILTIN_DEPS.has(name)) {
            onProgress?.(`Skipping built-in dependency: ${name}`)
            continue
        }
        queue.push({ name, dep })
    }

    // Track what we've already resolved or are resolving to avoid cycles
    const seen = new Set<string>()

    while (queue.length > 0) {
        const { name, dep, parentGit, parentRef } = queue.shift()!

        if (seen.has(name)) continue
        seen.add(name)

        // Determine git URL and ref
        const gitUrl = dep.git || parentGit
        const ref = dep.tag || dep.branch || parentRef

        if (!gitUrl) {
            // Version-only dependency without git URL -- skip for now
            // (these are typically registry deps which aren't supported yet in browser)
            if (dep.version) {
                onProgress?.(`Skipping registry dependency "${name}" (version ${dep.version}) -- not yet supported in browser`)
            } else if (dep.path) {
                onProgress?.(`Skipping local path dependency "${name}" (path: ${dep.path})`)
            }
            continue
        }

        if (!ref) {
            onProgress?.(`Warning: No tag or branch specified for "${name}" from ${gitUrl}, skipping`)
            continue
        }

        onProgress?.(`Resolving dependency: ${name}`)

        try {
            // Check cache first
            const cacheKey = makeCacheKey(gitUrl, ref, name)
            const cached = await getCachedPackage(cacheKey)

            let files: Record<string, string>
            let scarbToml: string | undefined

            let workspaceEdition: string | undefined

            if (cached) {
                onProgress?.(`Using cached version of "${name}"`)
                files = cached.files
                scarbToml = cached.scarbToml
                workspaceEdition = cached.workspaceEdition
            } else {
                // Download from GitHub
                const result = await fetchGitHubPackage(gitUrl, ref, name, onProgress)
                files = result.files
                scarbToml = result.scarbToml
                workspaceEdition = result.workspaceEdition

                // Cache the result
                await setCachedPackage({
                    key: cacheKey,
                    name,
                    files,
                    scarbToml,
                    workspaceEdition,
                    cachedAt: Date.now(),
                })
                onProgress?.(`Cached "${name}" for future use`)
            }

            // Parse the package's own Scarb.toml for transitive dependencies
            const transDeps: string[] = []
            if (scarbToml) {
                try {
                    const { package: depPkg, dependencies: depDeps } = parseScarbToml(scarbToml)

                    for (const [depName, depInfo] of Object.entries(depDeps)) {
                        if (BUILTIN_DEPS.has(depName)) continue
                        transDeps.push(depName)

                        // Queue transitive dependencies if not already resolved
                        if (!seen.has(depName)) {
                            queue.push({
                                name: depName,
                                dep: depInfo,
                                // Inherit git URL and ref from parent if not specified
                                parentGit: depInfo.git || gitUrl,
                                parentRef: depInfo.tag || depInfo.branch || ref,
                            })
                        }
                    }

                    // Use the dependency's edition if available.
                    // Handle `edition.workspace = true`: if edition is not a string,
                    // fall back to the workspace-level edition from the root Scarb.toml.
                    const resolvedEdition = typeof depPkg.edition === 'string'
                        ? depPkg.edition
                        : workspaceEdition

                    resolved[name] = {
                        name,
                        files,
                        edition: resolvedEdition,
                        dependencies: transDeps,
                    }
                } catch (err) {
                    console.warn(`[dep-resolver] Failed to parse Scarb.toml for ${name}:`, err)
                    resolved[name] = {
                        name,
                        files,
                        dependencies: [],
                    }
                }
            } else {
                resolved[name] = {
                    name,
                    files,
                    dependencies: [],
                }
            }
        } catch (err: any) {
            const errMsg = err.message || String(err)
            onProgress?.(`Failed to resolve "${name}": ${errMsg}`)
            console.error(`[dep-resolver] Failed to resolve ${name}:`, err)
            // Continue resolving other dependencies rather than failing entirely
        }
    }

    if (Object.keys(resolved).length > 0) {
        onProgress?.(`Resolved ${Object.keys(resolved).length} dependencies: ${Object.keys(resolved).join(', ')}`)
    }

    return resolved
}
