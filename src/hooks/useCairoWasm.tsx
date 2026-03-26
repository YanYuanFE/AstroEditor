import {useEffect, useRef} from "react";
import * as Comlink from "comlink";
import {useMutation} from "@tanstack/react-query";
import {CairoWorker} from "../../worker";
import {useSettingStore} from "@/stores/setting";


export const useCairoWasm = () => {
    const workerRef = useRef<CairoWorker>();
    const setData = useSettingStore(s => s.setData);

    const initWorker = async () => {
        const CairoWorkerWrap = Comlink.wrap<CairoWorker>(new Worker(new URL('../../worker.ts', import.meta.url), { type: 'module' }));
        // @ts-ignore
        const worker = await new CairoWorkerWrap();
        console.log(worker, 'worker')
        workerRef.current = worker;

        try {
            const versionJson = await worker.getCairoVersion();
            const version = JSON.parse(versionJson);
            setData({ cairoVersion: version.cairo });
        } catch (e) {
            console.warn('Failed to get Cairo version', e);
        }
    }

    useEffect(() => {
        initWorker();
    }, []);

    // ========== Single-file APIs ==========

    const { mutateAsync: runCairo, isPending: runLoading } = useMutation({
        mutationKey: ['runCairoProgram'],
        mutationFn: (params: any) => workerRef.current!.runCairoProgram(params),
    })

    const { mutateAsync: compileCairo, isPending: compileCairoLoading } = useMutation({
        mutationKey: ['compile-cairo'],
        mutationFn: (params: any) => workerRef.current!.compileCairoProgram(params),
    })

    const { mutateAsync: compileContract, isPending: compileContractLoading } = useMutation({
        mutationKey: ['compile-contract'],
        mutationFn: (params: any) => workerRef.current!.compileStarknetContract(params),
    })

    const { mutateAsync: runTests, isPending: testLoading } = useMutation({
        mutationKey: ['run-tests'],
        mutationFn: (params: any) => workerRef.current!.runTests(params),
    })

    // ========== Multi-file project APIs ==========

    const { mutateAsync: compileCairoProject, isPending: compileCairoProjectLoading } = useMutation({
        mutationKey: ['compile-cairo-project'],
        mutationFn: (params: any) => workerRef.current!.compileCairoProject(params),
    })

    const { mutateAsync: runCairoProject, isPending: runCairoProjectLoading } = useMutation({
        mutationKey: ['run-cairo-project'],
        mutationFn: (params: any) => workerRef.current!.runCairoProject(params),
    })

    const { mutateAsync: compileStarknetProject, isPending: compileStarknetProjectLoading } = useMutation({
        mutationKey: ['compile-starknet-project'],
        mutationFn: (params: any) => workerRef.current!.compileStarknetProject(params),
    })

    const { mutateAsync: runProjectTests, isPending: runProjectTestsLoading } = useMutation({
        mutationKey: ['run-project-tests'],
        mutationFn: (params: any) => workerRef.current!.runProjectTests(params),
    })

    return {
        // Single-file
        runCairo,
        compileCairo,
        runLoading,
        compileLoading: compileCairoLoading || compileContractLoading,
        compileContract,
        runTests,
        testLoading,
        // Multi-file project
        compileCairoProject,
        runCairoProject,
        compileStarknetProject,
        runProjectTests,
        compileProjectLoading: compileCairoProjectLoading || compileStarknetProjectLoading,
        runProjectLoading: runCairoProjectLoading,
        testProjectLoading: runProjectTestsLoading,
    }
}
