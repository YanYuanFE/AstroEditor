import {Abi, CairoAssembly, constants} from "starknet";

export type NetworkId = 'mainnet' | 'sepolia';

export interface Contract {
    name: string
    projectId: string
    projectName: string
    compiledClassHash: string
    classHash: string
    sierraClassHash: string
    sierra: any
    casm: any
    abi: Abi
    path: string
    compileInfo: string
    compiledAt: number
    deployedInfo: Array<{
        address: string
        network: NetworkId
        txHash: string
        timestamp: number
    }>
    declaredInfo: Array<{
        network: NetworkId
        classHash: string
        txHash: string
        timestamp: number
    }>
    address: string
}

export interface AbiInput {
    name: string
    type: string
}

export interface AbiFunction {
    name: string
    type: string
    inputs: AbiInput[]
    outputs?: { type: string }[]
    state_mutability?: 'view' | 'external'
}

// ========== Multi-file project types ==========

export interface Project {
    id: string
    name: string
    createdAt: number
    updatedAt: number
}

export interface FileNode {
    id: string
    projectId: string
    name: string
    path: string          // full relative path, e.g. "src/utils/math.cairo"
    type: 'file' | 'directory'
    content?: string      // only for files
    parentPath: string    // parent directory path, "" for root
}

export interface OpenTab {
    fileId: string
    path: string
    name: string
    isDirty: boolean
}
