import wasmCairo, {
    compileStarknetContract,
    runTests,
    runCairoProgram,
    compileCairoProgram,
    greet,
    getCairoVersion,
    // Multi-file project APIs
    compileCairoProject,
    runCairoProject,
    compileStarknetProject,
    runProjectTests,
} from './src/pkg/wasm-cairo.js';
import * as Comlink from 'comlink';

interface ITestOptions {
    cairoProgram: string;
    allowWarnings: boolean;
    filter: string;
    includeIgnored: boolean;
    ignored: boolean;
    starknet: boolean;
    runProfiler: string;
    gasDisabled: boolean;
    printResourceUsage: boolean;
}

interface IProjectInput {
    projectJson: string;
}

class CairoWorker {
    private initPromise: Promise<void>;

    init = async () => {
        await wasmCairo();
        greet('Hello World');
    }
    constructor() {
        this.initPromise = this.init();
    }

    // ========== Version info ==========

    async getCairoVersion() {
        await this.initPromise;
        return getCairoVersion();
    }

    // ========== Single-file APIs ==========

    async runCairoProgram({cairoProgram, availableGas, printFullMemory, useDBGPrintHint, allWarnings = true, runProfiler = false}: any) {
        const res = runCairoProgram(cairoProgram, availableGas, allWarnings, printFullMemory, runProfiler, useDBGPrintHint);
        return res;
    }

    async compileCairoProgram({cairoProgram, replaceIds}: any) {
        const res = compileCairoProgram(cairoProgram, replaceIds);
        return res;
    }
    async compileStarknetContract({starknetContract, allowWarnings, replaceIds, outputCasm = false}: any) {
        const res = compileStarknetContract(starknetContract, allowWarnings, replaceIds, outputCasm);
        return res;
    }
    async runTests({cairoProgram, allowWarnings = true, filter = '', includeIgnored = true, ignored = true, starknet = false, runProfiler = '', gasDisabled = true, printResourceUsage = true,  }: ITestOptions) {
        const res = runTests(cairoProgram, allowWarnings, filter, includeIgnored, ignored, starknet, runProfiler, gasDisabled, printResourceUsage);
        return res;
    }

    // ========== Multi-file project APIs ==========

    async compileCairoProject({projectJson, replaceIds = true}: any) {
        const res = compileCairoProject(projectJson, replaceIds);
        return res;
    }

    async runCairoProject({projectJson, availableGas, allowWarnings = true, printFullMemory = true, runProfiler = false, useDBGPrintHint = true}: any) {
        const res = runCairoProject(projectJson, availableGas, allowWarnings, printFullMemory, runProfiler, useDBGPrintHint);
        return res;
    }

    async compileStarknetProject({projectJson, allowWarnings = true, replaceIds = true, outputCasm = false}: any) {
        const res = compileStarknetProject(projectJson, allowWarnings, replaceIds, outputCasm);
        return res;
    }

    async runProjectTests({projectJson, allowWarnings = true, filter = '', includeIgnored = true, ignored = true, starknet = false, gasDisabled = true, printResourceUsage = true}: any) {
        const res = runProjectTests(projectJson, allowWarnings, filter, includeIgnored, ignored, starknet, gasDisabled, printResourceUsage);
        return res;
    }
}

export {CairoWorker};

Comlink.expose(CairoWorker);
