import {create} from "zustand";
import {persist} from "zustand/middleware";
import type {Contract, NetworkId} from "@/types";

export type DeployStep = 'idle' | 'declaring' | 'declared' | 'deploying' | 'deployed';

interface StoreState {
    contracts: Record<string, Partial<Contract>>;
    deployStep: DeployStep;
    declaredClassHash: string;
    deployedAddress: string;
    selectedNetwork: NetworkId;
    setData: (v: Record<string, Partial<Contract>>) => void;
    setDeployStep: (step: DeployStep) => void;
    setDeclaredClassHash: (hash: string) => void;
    setDeployedAddress: (address: string) => void;
    setSelectedNetwork: (network: NetworkId) => void;
    resetDeploy: () => void;
    removeContract: (projectId: string) => void;
    clearAllContracts: () => void;
    addDeclareInfo: (name: string, info: { network: NetworkId; classHash: string; txHash: string }) => void;
    addDeployInfo: (name: string, info: { network: NetworkId; address: string; txHash: string }) => void;
}

export const useContractStore = create<StoreState>()(
    persist(
        (set, get) => ({
            contracts: {},
            deployStep: 'idle' as DeployStep,
            declaredClassHash: '',
            deployedAddress: '',
            selectedNetwork: 'sepolia' as NetworkId,
            setData: (v: Record<string, Partial<Contract>>) => {
                set({
                    contracts: {...get().contracts, ...v},
                    // Reset deploy state when new contract data arrives
                    deployStep: 'idle',
                    declaredClassHash: '',
                    deployedAddress: '',
                })
            },
            setDeployStep: (step: DeployStep) => set({ deployStep: step }),
            setDeclaredClassHash: (hash: string) => set({ declaredClassHash: hash }),
            setDeployedAddress: (address: string) => set({ deployedAddress: address }),
            setSelectedNetwork: (network: NetworkId) => set({ selectedNetwork: network }),
            resetDeploy: () => set({
                deployStep: 'idle',
                declaredClassHash: '',
                deployedAddress: '',
            }),
            removeContract: (projectId: string) => {
                const { [projectId]: _, ...rest } = get().contracts;
                set({ contracts: rest });
            },
            clearAllContracts: () => {
                set({
                    contracts: {},
                    deployStep: 'idle',
                    declaredClassHash: '',
                    deployedAddress: '',
                });
            },
            addDeclareInfo: (projectId, info) => {
                const contracts = { ...get().contracts };
                const c = contracts[projectId];
                if (!c) return;
                const declaredInfo = [...(c.declaredInfo || [])];
                // Replace existing entry for same network, or push new
                const idx = declaredInfo.findIndex(d => d.network === info.network);
                const entry = { ...info, timestamp: Date.now() };
                if (idx >= 0) declaredInfo[idx] = entry;
                else declaredInfo.push(entry);
                contracts[projectId] = { ...c, declaredInfo };
                set({ contracts });
            },
            addDeployInfo: (projectId, info) => {
                const contracts = { ...get().contracts };
                const c = contracts[projectId];
                if (!c) return;
                const deployedInfo = [...(c.deployedInfo || [])];
                const entry = { ...info, timestamp: Date.now() };
                deployedInfo.push(entry);
                contracts[projectId] = { ...c, deployedInfo };
                set({ contracts });
            },
        }),
        {
            name: 'astro-contracts-storage',
            version: 2,
            migrate: (persistedState: any) => {
                if (!persistedState?.contracts) return persistedState;
                return {
                    ...persistedState,
                    contracts: Object.fromEntries(
                        Object.entries(persistedState.contracts).filter(([, value]: any) => {
                            return Boolean(value?.projectId);
                        }),
                    ),
                };
            },
            partialize: (state) => ({
                contracts: Object.fromEntries(
                    Object.entries(state.contracts).map(([k, v]) => [k, {
                        ...v,
                        // Keep sierra, casm, and abi so declare works after HMR / rehydration
                        compileInfo: undefined,
                    }])
                ),
                selectedNetwork: state.selectedNetwork,
            }),
        },
    ),
)
