// import wasm_bindgen, { greet, compileCairoProgram, runCairoProgram, compileStarknetContract } from '@/pkg/wasm-cairo';

import wasmCairo, { compileStarknetContract, runTests, runCairoProgram, compileCairoProgram, greet } from 'wasm-cairo';

// const url = new URL('/wasm-cairo_bg.wasm', import.meta.url).href;

(async () => {
    await wasmCairo();
    // await wasm_bindgen(url)

    console.log(greet("StarknetAstro"))
})();

window.onmessage = async function (e) {
    const {data, functionToRun, replaceIds} = e.data;
    await wasmCairo();
    let result;
    switch (functionToRun) {
        case "runCairoProgram":
            const {availableGas, printFullMemory, useDBGPrintHint} = e.data;
            result = runCairoProgram(data, availableGas, printFullMemory, useDBGPrintHint);
            break;
        case "compileCairoProgram":
            result = compileCairoProgram(data, replaceIds);
            break;
        case "compileStarknetContract":
            result = compileStarknetContract(data, replaceIds);
            break;
        default:
            console.error(`Unexpected function: ${functionToRun}`);
            return;
    }
    console.log("text: " + result)
    postMessage(result);
}