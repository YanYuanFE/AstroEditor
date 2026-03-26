import {
    AccountInterface,
    RpcProvider,
    Contract as StarknetContract,
    Abi,
    hash,
} from "starknet";
import type { Contract, NetworkId, AbiFunction } from "@/types";
import { normalizeAbi, computeWalletClassHash } from "./starknet";

const RPC_URLS: Record<NetworkId, string> = {
    mainnet: 'https://starknet-mainnet.infura.io/v3/0ec19e54a9be4e9c9b72abce5d3515e2',
    sepolia: 'https://starknet-sepolia.infura.io/v3/0ec19e54a9be4e9c9b72abce5d3515e2',
};

export function getRpcProvider(network: NetworkId): RpcProvider {
    return new RpcProvider({ nodeUrl: RPC_URLS[network] });
}

export async function isClassDeclared(
    provider: RpcProvider,
    classHash: string,
): Promise<boolean> {
    try {
        await provider.getClass(classHash);
        return true;
    } catch {
        return false;
    }
}

export async function declareContract(
    account: AccountInterface,
    contractData: Partial<Contract>,
    network: NetworkId = 'mainnet',
): Promise<{ classHash: string; txHash: string; alreadyDeclared?: boolean }> {
    const sierra = contractData.sierra!;
    const casm = contractData.casm!;

    // Normalize ABI: unwrap multi-encoded string to a plain array.
    const abiArray = normalizeAbi(sierra.abi);
    const cleanSierra = {
        sierra_program: sierra.sierra_program,
        contract_class_version: sierra.contract_class_version,
        entry_points_by_type: sierra.entry_points_by_type,
        abi: abiArray,
    };

    const compiledClassHash = hash.computeCompiledClassHash(casm);
    // Compute class hash matching wallet behavior (ABI as string → double-encoding)
    const walletHash = computeWalletClassHash(cleanSierra, abiArray);

    // Check if already declared on-chain
    const provider = getRpcProvider(network);
    const declared = await isClassDeclared(provider, walletHash);
    if (declared) {
        return { classHash: walletHash, txHash: '', alreadyDeclared: true };
    }

    const result = await account.declare({
        contract: cleanSierra as any,
        casm,
        compiledClassHash,
    });
    await account.waitForTransaction(result.transaction_hash);
    return {
        classHash: result.class_hash,
        txHash: result.transaction_hash,
    };
}

export async function deployContract(
    account: AccountInterface,
    classHash: string,
    constructorCalldata: any[],
): Promise<{ contractAddress: string; txHash: string }> {
    const result = await account.deployContract({
        classHash,
        constructorCalldata,
    });
    await account.waitForTransaction(result.transaction_hash);
    const addr = Array.isArray(result.contract_address)
        ? result.contract_address[0]
        : result.contract_address;
    return {
        contractAddress: addr,
        txHash: result.transaction_hash,
    };
}

export function getConstructor(abi: Abi): AbiFunction | null {
    if (!abi) return null;
    return (abi.find((item: any) => item.type === 'constructor') as unknown as AbiFunction) ?? null;
}

export function getFunctionList(abi: Abi): AbiFunction[] {
    if (!abi) return [];
    const allFunctions = abi.flatMap((item: any) => {
        if (item.type === 'function') return [item];
        if (item.type === 'interface') return item.items?.filter((i: any) => i.type === 'function') ?? [];
        return [];
    });
    return allFunctions as unknown as AbiFunction[];
}

export function isViewFunction(fn: AbiFunction): boolean {
    return fn.state_mutability === 'view';
}

export async function readContract(
    provider: RpcProvider,
    contractAddress: string,
    abi: Abi,
    functionName: string,
    calldata: any[],
): Promise<string> {
    const contract = new StarknetContract({ abi, address: contractAddress, providerOrAccount: provider });
    const result = await contract.call(functionName, calldata);
    return stringifyResult(result);
}

export async function writeContract(
    account: AccountInterface,
    contractAddress: string,
    abi: Abi,
    functionName: string,
    calldata: any[],
): Promise<{ txHash: string }> {
    const contract = new StarknetContract({ abi, address: contractAddress, providerOrAccount: account });
    const result = await contract.invoke(functionName, calldata);
    await account.waitForTransaction(result.transaction_hash);
    return { txHash: result.transaction_hash };
}

function stringifyResult(result: any): string {
    if (result === null || result === undefined) return '';
    if (typeof result === 'object') {
        return JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
    }
    return result.toString();
}

export function getExplorerUrl(network: NetworkId, txHash: string): string {
    const base = network === 'mainnet' ? 'https://starkscan.co' : 'https://sepolia.starkscan.co';
    return `${base}/tx/${txHash}`;
}

export function getExplorerContractUrl(network: NetworkId, address: string): string {
    const base = network === 'mainnet' ? 'https://starkscan.co' : 'https://sepolia.starkscan.co';
    return `${base}/contract/${address}`;
}
