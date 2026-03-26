
import wasmCairo, { compileStarknetContract, runTests, runCairoProgram, compileCairoProgram, compileCairoProject, runCairoProject, compileStarknetProject, runProjectTests, greet } from 'wasm-cairo';


(async () => {
    await wasmCairo();
    // await wasm_bindgen(url)

    console.log(greet("StarknetAstro"))
})();

async function handleMessage (e) {
    const {data, functionToRun, replaceIds} = e.data;
    await wasmCairo();
    let result;
    console.log(e.data)
    switch (functionToRun) {
        case "runCairoProgram":
            const {availableGas, printFullMemory, useDBGPrintHint} = e.data;
            result = runCairoProgram(data, availableGas, true, printFullMemory, false, useDBGPrintHint);
            break;
        case "compileCairoProgram":
            result = compileCairoProgram(data, replaceIds);
            break;
        case "compileStarknetContract":
            result = compileStarknetContract(data, true, replaceIds);
            break;
        case "runTest":
            result = runTests(data, true, false, true, true, false, false, true, true);
            break;
        case "compileCairoProject":
            result = compileCairoProject(data, replaceIds);
            break;
        case "runCairoProject": {
            const {availableGas: gas2, printFullMemory: pfm2, useDBGPrintHint: dbg2} = e.data;
            result = runCairoProject(data, gas2, true, pfm2, false, dbg2);
            break;
        }
        case "compileStarknetProject":
            result = compileStarknetProject(data, true, replaceIds, e.data.outputCasm || false);
            break;
        case "runProjectTests":
            result = runProjectTests(data, true, "", false, false, e.data.starknet || false, false, false);
            break;
        default:
            console.error(`Unexpected function: ${functionToRun}`);
            return;
    }
    console.log("text: " + result)
    postMessage(result);
}

addEventListener('message', handleMessage)