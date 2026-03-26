/* tslint:disable */
/* eslint-disable */

export function compileCairoProgram(cairo_program: string, replace_ids: boolean): string;

/**
 * Compile a multi-file Cairo project to Sierra.
 * Input: JSON string with `project_name`, `files` map, and optional `dependencies`.
 */
export function compileCairoProject(project_json: string, replace_ids: boolean): string;

export function compileStarknetContract(starknet_contract: string, allow_warnings: boolean, replace_ids: boolean, output_casm: boolean): string;

/**
 * Compile a multi-file Starknet contract project.
 * Input: JSON string with `project_name`, `files` map, and optional `dependencies`.
 * When `output_casm` is true, returns JSON with both `sierra` and `casm` fields.
 * When false, returns Sierra ContractClass JSON only (backward compatible).
 */
export function compileStarknetProject(project_json: string, allow_warnings: boolean, replace_ids: boolean, output_casm: boolean): string;

export function getCairoVersion(): string;

export function greet(s: string): string;

export function runCairoProgram(cairo_program: string, available_gas: number | null | undefined, allow_warnings: boolean, print_full_memory: boolean, run_profiler: boolean, use_dbg_print_hint: boolean): string;

/**
 * Run a multi-file Cairo project.
 * Input: JSON string with `project_name`, `files` map, and optional `dependencies`.
 */
export function runCairoProject(project_json: string, available_gas: number | null | undefined, allow_warnings: boolean, print_full_memory: boolean, run_profiler: boolean, use_dbg_print_hint: boolean): string;

/**
 * Run tests in a multi-file Cairo project.
 * Input: JSON string with `project_name`, `files` map, and optional `dependencies`.
 */
export function runProjectTests(project_json: string, allow_warnings: boolean, filter: string, include_ignored: boolean, ignored: boolean, starknet: boolean, gas_disabled: boolean, print_resource_usage: boolean): string;

export function runTests(cairo_program: string, allow_warnings: boolean, filter: string, include_ignored: boolean, ignored: boolean, starknet: boolean, run_profiler: string, gas_disabled: boolean, print_resource_usage: boolean): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly compileCairoProgram: (a: number, b: number, c: number, d: number) => void;
    readonly compileCairoProject: (a: number, b: number, c: number, d: number) => void;
    readonly compileStarknetContract: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly compileStarknetProject: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly getCairoVersion: (a: number) => void;
    readonly greet: (a: number, b: number, c: number) => void;
    readonly runCairoProgram: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly runCairoProject: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly runProjectTests: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly runTests: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => void;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export2: (a: number) => void;
    readonly __wbindgen_export3: (a: number, b: number) => number;
    readonly __wbindgen_export4: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
