import {hash} from "starknet";
import {Contract} from "@/types";

/**
 * Unwrap a possibly multi-encoded ABI value to a plain array.
 * The Cairo compiler (especially via WASM) can produce ABI strings that are
 * double- or triple-JSON-encoded. Keep parsing until we get an array.
 */
export function normalizeAbi(abi: any): any[] {
    let v = abi;
    for (let i = 0; i < 5 && typeof v === 'string'; i++) {
        try { v = JSON.parse(v); } catch { break; }
    }
    return Array.isArray(v) ? v : [];
}

/**
 * Compute class hash matching wallet behavior.
 *
 * WalletAccount.declare() converts ABI array to a JSON string before sending
 * to the wallet extension. When starknet.js's computeContractClassHash receives
 * ABI as a string, its internal hashAbi calls stringify2(string) which
 * double-encodes it (adds outer quotes + escapes). This produces the same hash
 * the wallet computes on-chain.
 *
 * By passing ABI as a JSON string here, we replicate that double-encoding.
 */
export function computeWalletClassHash(sierra: any, abiArray: any[]): string {
    return hash.computeContractClassHash({
        ...sierra,
        abi: JSON.stringify(abiArray),
    });
}

export async function genContractData (
    projectId: string,
    projectName: string,
    contractName: string,
    compileResult: string,
): Promise<Partial<Contract> | null> {
    // If the compile result is not valid JSON, it's an error message
    let data: any
    try {
        data = JSON.parse(compileResult)
    } catch {
        console.warn('[genContractData] Compile result is not valid JSON:', compileResult.substring(0, 200))
        return null
    }

    // Handle both formats:
    // - output_casm=true: { sierra: {...}, casm: {...} }
    // - output_casm=false: plain Sierra ContractClass JSON
    let sierra: any
    let casm: any
    let compiledClassHash = ''

    if (data.sierra && data.casm) {
        sierra = data.sierra
        casm = data.casm
        try {
            compiledClassHash = hash.computeCompiledClassHash(casm)
        } catch (e) {
            console.warn('[genContractData] computeCompiledClassHash failed:', e)
        }
    } else {
        sierra = data
    }

    // Normalize ABI: unwrap multi-encoded string to a plain array.
    const abiArray = normalizeAbi(sierra.abi);
    sierra = { ...sierra, abi: abiArray };

    // Compute class hash matching wallet behavior (ABI as string → double-encoding)
    let classHash = ''
    try {
        classHash = computeWalletClassHash(sierra, abiArray);
    } catch (e) {
        console.warn('[genContractData] computeWalletClassHash failed:', e)
    }

    return {
        name: contractName,
        projectId,
        projectName,
        abi: abiArray,
        compiledClassHash,
        classHash,
        sierra,
        casm,
        compileInfo: compileResult,
        compiledAt: Date.now(),
        deployedInfo: [],
        address: '',
        declaredInfo: [],
    }
}
