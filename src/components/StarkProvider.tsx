import { sepolia, mainnet } from '@starknet-react/chains';
import {
    argent,
    braavos,
    jsonRpcProvider,
    StarknetConfig,
    starkscan,
    useInjectedConnectors,
    Connector, useAccount, useConnect, useDisconnect, useProvider
} from '@starknet-react/core';

const RPC_URLS: Record<string, string> = {
    [mainnet.id.toString()]: 'https://starknet-mainnet.infura.io/v3/0ec19e54a9be4e9c9b72abce5d3515e2',
    [sepolia.id.toString()]: 'https://starknet-sepolia.infura.io/v3/0ec19e54a9be4e9c9b72abce5d3515e2',
};

export function StarknetProvider({ children }: { children: React.ReactNode }) {
    const { connectors } = useInjectedConnectors({
        recommended: [argent(), braavos()],
        includeRecommended: 'onlyIfNoConnectors',
        order: 'alphabetical'
    });

    const provider = jsonRpcProvider({
        rpc: (chain) => ({
            nodeUrl: RPC_URLS[chain.id.toString()] || RPC_URLS[mainnet.id.toString()],
        }),
    });

    return (
        <StarknetConfig
            autoConnect
            chains={[mainnet, sepolia]}
            provider={provider}
            connectors={connectors}
            explorer={starkscan}
        >
            {children}
        </StarknetConfig>
    );
}