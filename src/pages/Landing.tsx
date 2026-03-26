import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import logo from '@/assets/logo.png'
import {
  Code2, Rocket, FolderTree, TestTube,
  Github, ArrowRight, Star, Terminal,
} from 'lucide-react'

/* ── Data ─────────────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Code2,
    title: 'WASM Compiler',
    desc: 'Full Cairo compiler running in your browser via WebAssembly. Zero installation, zero setup.',
  },
  {
    icon: Rocket,
    title: 'Deploy to Starknet',
    desc: 'Declare and deploy smart contracts to Sepolia or Mainnet directly with your wallet.',
  },
  {
    icon: FolderTree,
    title: 'Multi-file Projects',
    desc: 'Organize code across files and modules with automatic dependency resolution.',
  },
  {
    icon: TestTube,
    title: 'Built-in Tests',
    desc: 'Write and run Cairo tests directly in the browser. Instant feedback loop.',
  },
]

const STEPS = [
  { num: '01', icon: Terminal, label: 'Write', text: 'Cairo code with syntax highlighting and autocomplete' },
  { num: '02', icon: Code2, label: 'Compile', text: 'Instant compilation via in-browser WASM compiler' },
  { num: '03', icon: Rocket, label: 'Deploy', text: 'One-click declare & deploy to Starknet' },
]

const CAIRO_CODE = `#[starknet::interface]
trait ICounter<TContractState> {
    fn get_count(self: @TContractState) -> u64;
    fn increment(ref self: TContractState);
}

#[starknet::contract]
mod Counter {
    #[storage]
    struct Storage {
        count: u64,
    }

    #[abi(embed_v0)]
    impl CounterImpl of super::ICounter<ContractState> {
        fn get_count(self: @ContractState) -> u64 {
            self.count.read()
        }

        fn increment(ref self: ContractState) {
            self.count.write(self.count.read() + 1);
        }
    }
}`

/* ── Syntax highlighting ──────────────────────────────────────────────────── */

function highlightCairo(code: string): string {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Attributes
    .replace(/(#\[[^\]]*\])/g, '<span style="color:#ffa657">$1</span>')
    // Keywords
    .replace(
      /\b(fn|mod|struct|trait|impl|of|ref|self|let|mut|return|use|super|pub)\b/g,
      '<span style="color:#ff7b72">$1</span>',
    )
    // Types
    .replace(
      /\b(u64|u128|u256|u32|u16|u8|felt252|bool|ContractState|TContractState)\b/g,
      '<span style="color:#79c0ff">$1</span>',
    )
    // Names
    .replace(
      /\b(ICounter|Counter|CounterImpl|Storage)\b/g,
      '<span style="color:#d2a8ff">$1</span>',
    )
    // Method calls
    .replace(
      /\b(get_count|increment|read|write)\b/g,
      '<span style="color:#d2a8ff">$1</span>',
    )
    // Numbers (avoid matching inside html tags)
    .replace(/\b(\d+)\b(?![^<]*>)/g, '<span style="color:#79c0ff">$1</span>')
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div
      className="min-h-dvh bg-[#030712] text-[#f0f0f8] selection:bg-[#f15a4a]/30"
      style={{
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-[#030712]/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} className="size-7 rounded-lg" alt="AstroEditor" />
            <span className="font-display font-bold tracking-tight">
              AstroEditor
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/StarknetAstro/AstroEditor"
              target="_blank"
              rel="noreferrer"
              className="p-2 text-[#555] hover:text-white transition-colors"
              aria-label="View source on GitHub"
            >
              <Github size={18} />
            </a>
            <Link to="/editor">
              <Button
                size="sm"
                className="bg-[#f15a4a] text-white hover:bg-[#e04d40] border-0 font-medium"
              >
                Launch Editor
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="pt-36 sm:pt-44 pb-20 sm:pb-28 px-6">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-sm text-[#8888a0] mb-8">
            <Star size={14} className="text-[#f15a4a]" />
            <span>Built for Cairo & Starknet</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl sm:text-6xl lg:text-[4.5rem] font-extrabold text-balance leading-[1.06] tracking-tight mb-6">
            Code Cairo in{' '}
            <span className="text-[#f15a4a]">Your Browser</span>
          </h1>

          {/* Subtext */}
          <p className="text-lg text-[#7a7a90] max-w-xl mx-auto text-pretty leading-relaxed mb-10">
            Write, compile, test, and deploy Cairo smart contracts on Starknet.
            No installation. No configuration. Just code.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/editor">
              <Button className="bg-[#f15a4a] text-white hover:bg-[#e04d40] border-0 h-11 px-7 text-sm font-medium">
                Launch Editor
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
            <a
              href="https://github.com/StarknetAstro/AstroEditor"
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="outline"
                className="border-white/[0.1] bg-transparent text-[#bbb] hover:bg-white/[0.05] hover:text-white h-11 px-7 text-sm"
              >
                <Github size={16} className="mr-2" />
                View on GitHub
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ── Code Window ─────────────────────────────────────────────────── */}
      <section className="px-6 pb-28 sm:pb-36">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-xl border border-white/[0.08] bg-[#0d1117] overflow-hidden shadow-2xl">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 h-10 border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <div className="size-2.5 rounded-full bg-[#f15a4a]/60" />
                <div className="size-2.5 rounded-full bg-white/[0.1]" />
                <div className="size-2.5 rounded-full bg-white/[0.1]" />
              </div>
              <span className="text-[11px] text-[#484f58] font-mono ml-2">
                counter.cairo
              </span>
            </div>
            {/* Code body */}
            <div className="overflow-x-auto">
              <pre className="p-5 text-[13px] leading-[1.75] font-mono text-[#e6edf3]">
                <code
                  dangerouslySetInnerHTML={{
                    __html: highlightCairo(CAIRO_CODE),
                  }}
                />
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="px-6 pb-28 sm:pb-36">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center text-balance mb-14">
            Write. Compile. Deploy.
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <div
                key={s.num}
                className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-6"
              >
                <span className="font-mono text-xs text-[#f15a4a]/60 mb-4 block">
                  {s.num}
                </span>
                <div className="size-10 rounded-lg bg-white/[0.04] flex items-center justify-center mb-4">
                  <s.icon size={20} className="text-[#8888a0]" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-1.5">
                  {s.label}
                </h3>
                <p className="text-sm text-[#6e6e85] text-pretty leading-relaxed">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="px-6 pb-28 sm:pb-36">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center text-balance mb-3">
            Everything you need
          </h2>
          <p className="text-[#7a7a90] text-center text-pretty max-w-lg mx-auto mb-14">
            From your first line of Cairo to production deployment — all in one
            place.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/[0.1] transition-colors"
              >
                <div className="size-10 rounded-lg bg-[#f15a4a]/10 flex items-center justify-center mb-4">
                  <f.icon size={20} className="text-[#f15a4a]" />
                </div>
                <h3 className="font-display font-semibold text-base mb-1.5">
                  {f.title}
                </h3>
                <p className="text-sm text-[#6e6e85] text-pretty leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
      <section className="px-6 pb-28 sm:pb-36">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/[0.06] bg-white/[0.02] py-16 px-6 text-center">
          <h2 className="font-display text-3xl font-bold text-balance mb-3">
            Start building on Starknet
          </h2>
          <p className="text-[#7a7a90] text-pretty mb-8">
            Open the editor and write your first smart contract in Cairo.
          </p>
          <Link to="/editor">
            <Button className="bg-[#f15a4a] text-white hover:bg-[#e04d40] border-0 h-11 px-7 text-sm font-medium">
              Launch Editor
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] px-6 py-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={logo} className="size-5 rounded" alt="" />
            <span className="text-sm text-[#484f58]">AstroEditor</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#484f58]">
            <a
              href="https://github.com/StarknetAstro/AstroEditor"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://www.cairo-lang.org/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              Cairo
            </a>
            <a
              href="https://www.starknet.io/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              Starknet
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
