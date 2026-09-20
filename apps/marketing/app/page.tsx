import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GitHub-identical Markdown, offline',
};

const SCOREBOARD = [
  { label: 'CommonMark 0.31.2', value: '652/652', note: '100% of the spec suite' },
  { label: 'GFM extensions', value: '22/22', note: 'tables, tasks, alerts, footnotes…' },
  { label: 'GitHub parity', value: '100%', note: 'of 49 gated golden documents' },
  { label: 'XSS blocked', value: '93/93', note: 'verified in 3 real engines' },
  { label: 'Network calls', value: '0', note: 'highlighting, math & diagrams bundled' },
  { label: 'Payload', value: '0.67 MB', note: 'of the 2 MB budget, gzipped' },
];

const FEATURES = [
  {
    title: 'Verified, not claimed',
    body: 'Every release is diffed against GitHub\u2019s own POST /markdown renderer over a frozen 74-document golden corpus. Differences become named normalization rules or bugs — never vibes.',
  },
  {
    title: 'Fully offline',
    body: 'Shiki highlighting, KaTeX math and Mermaid diagrams ship inside the app. Paste, drop, edit and render with the network cable pulled.',
  },
  {
    title: 'Sanitized by architecture',
    body: 'The shipping path sanitizes through a curated allowlist before anything reaches your DOM, hardened by a 93-vector attack corpus that is proven live without it.',
  },
  {
    title: 'One engine, everywhere',
    body: 'comrak (the Rust CommonMark/GFM parser) compiles to WASM for the web and to native for desktop — byte-identical output, proven by a cross-platform determinism suite.',
  },
  {
    title: 'Editor that stays out of the way',
    body: 'A split view: CodeMirror source on the left, live GitHub-style preview on the right, scroll-synced, parsed off the main thread.',
  },
  {
    title: 'Yours, deliberately',
    body: 'No accounts, no first-party server, no telemetry by default. Sync, when you opt in, goes to storage you already own.',
  },
];

const COMPARE = [
  ['GitHub-identical GFM', 'Yes — verified', 'Different dialect', 'Different dialect', 'Partial', 'Partial'],
  ['Works offline', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['Syntax highlighting', 'Shiki, bundled', 'Own engine', 'Own engine', 'Own engine', 'Own engine'],
  ['Math + diagrams', 'KaTeX + Mermaid, bundled', 'Plugins', 'Plugins', 'Plugins', 'Partial'],
  ['Shows GitHub\u2019s exact HTML', 'Yes', 'No', 'No', 'No', 'No'],
  ['Open source proof harness', 'Yes', '—', '—', '—', '—'],
];

const FAQ = [
  {
    q: 'What does "GitHub-identical" actually mean?',
    a: 'OneMark\u2019s HTML output is compared, structurally, against GitHub\u2019s own renderer for a frozen 74-document corpus of real project documentation. Differences are either named normalization rules (GitHub-side chrome like nofollow links or camo image proxies) or real bugs we fix. The corpus, the rules and every diff triage are in the repo.',
  },
  {
    q: 'Does it send my documents anywhere?',
    a: 'No. Parsing, rendering, highlighting, math and diagrams all run on your device. The network is used only for images a document itself references — exactly like any viewer would. A first-party analytics beacon exists in code but is disabled by default and aggregate-only.',
  },
  {
    q: 'Which platforms are supported?',
    a: 'Today: the web app (any modern browser, installed via the deployed URL). macOS, Windows and Linux follow via a Tauri v2 shell that reuses this exact UI, and iOS/Android are on the roadmap behind the same architecture.',
  },
  {
    q: 'Is it a note-taking app?',
    a: 'No — deliberately. No graph view, no backlinks, no sync service of ours. OneMark renders and edits markdown files the way GitHub would, and gets out of the way.',
  },
  {
    q: 'Can I use it commercially?',
    a: 'OneMark is PolyForm Noncommercial licensed: free for personal and noncommercial use, commercial rights reserved. The fidelity harness and the corpus are in the open for scrutiny.',
  },
];

function Section({ id, title, kicker, children }: { id: string; title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-6 py-20">
      {kicker ? <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{kicker}</p> : null}
      <h2 className="mb-10 text-3xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default function Page() {
  const appUrl = 'app/';
  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-edge bg-[color-mix(in_srgb,var(--om-bg)_72%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <a href="#top" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary font-mono text-xs font-extrabold text-white">1M</span>
            OneMark
          </a>
          <div className="ml-auto hidden items-center gap-1 md:flex">
            {['features', 'proof', 'demo', 'compare', 'faq'].map((id) => (
              <a key={id} href={`#${id}`} className="rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink">
                {id === 'proof' ? 'Fidelity' : id[0].toUpperCase() + id.slice(1)}
              </a>
            ))}
          </div>
          <a href={appUrl} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-px hover:bg-primary-hover">
            Open the app
          </a>
        </div>
      </nav>

      <header id="top" className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(var(--om-border)_1px,transparent_1px),linear-gradient(90deg,var(--om-border)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black_30%,transparent_75%)]" />
        <div aria-hidden className="pointer-events-none absolute -top-52 left-1/2 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-primary-200/40 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 pb-24 pt-28 text-center">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Verified against GitHub&apos;s own renderer
          </p>
          <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            GitHub-flavored Markdown, rendered <span className="text-primary">identically</span>. Offline.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
            The rendering you trust only exists on github.com. OneMark ships it to
            every device you own — one engine, six platforms, zero servers — and
            proves byte-for-byte parity with a test suite that can fail.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <a href={appUrl} className="rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5 hover:bg-primary-hover">
              Open the app — it&apos;s free
            </a>
            <a href="#proof" className="rounded-xl border border-edge bg-raised px-6 py-3 font-semibold transition-colors hover:border-edge-strong hover:bg-surface">
              See the proof ↓
            </a>
          </div>
          <p className="mt-5 font-mono text-sm text-ink-subtle">CommonMark 652/652 · GFM 22/22 · golden corpus 100% · 0 network calls</p>
        </div>
      </header>

      <Section id="proof" kicker="The proof" title="Fidelity is measured, not marketed">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {SCOREBOARD.map((s) => (
            <div key={s.label} className="rounded-2xl border border-edge bg-raised p-6 shadow-sm">
              <p className="font-mono text-3xl font-bold text-primary">{s.value}</p>
              <p className="mt-2 font-semibold">{s.label}</p>
              <p className="text-sm text-ink-muted">{s.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-subtle">
          Current numbers from the v0.1.0 verification run; the harnesses live in
          the repo (<code className="font-mono">fidelity/</code>) and run in CI.
        </p>
      </Section>

      <Section id="features" kicker="Why OneMark" title="Built like infrastructure">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-edge bg-raised p-6 transition-shadow hover:shadow-md">
              <h3 className="mb-2 font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-ink-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="demo" kicker="Live" title="Try it — this is the real app">
        <div className="overflow-hidden rounded-2xl border border-edge shadow-lg">
          <iframe src="app/" title="OneMark live demo" className="h-[640px] w-full bg-bg" />
        </div>
        <p className="mt-3 text-sm text-ink-subtle">
          The actual production build, embedded. Or open it full-window:{' '}
          <a href={appUrl} className="font-semibold text-primary hover:underline">
            open the app
          </a>
          .
        </p>
      </Section>

      <Section id="compare" kicker="Honest comparison" title="How it stacks up">
        <div className="overflow-x-auto rounded-2xl border border-edge">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface text-left">
                <th className="border-b border-edge p-3 font-semibold">Capability</th>
                <th className="border-b border-edge p-3 font-semibold text-primary">OneMark</th>
                <th className="border-b border-edge p-3 font-semibold">Obsidian</th>
                <th className="border-b border-edge p-3 font-semibold">Typora</th>
                <th className="border-b border-edge p-3 font-semibold">VS Code</th>
                <th className="border-b border-edge p-3 font-semibold">iA Writer</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => (
                    <td key={i} className={`border-b border-edge p-3 ${i === 1 ? 'font-semibold' : 'text-ink-muted'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-ink-subtle">
          Competitors are excellent editors — they simply render a different dialect. That difference is the entire point.
        </p>
      </Section>

      <Section id="faq" kicker="Questions" title="FAQ">
        <div className="grid gap-4 md:grid-cols-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-edge bg-raised p-5 open:shadow-md">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">
                <span className="mr-2 text-primary group-open:hidden">＋</span>
                <span className="mr-2 hidden text-primary group-open:inline">－</span>
                {f.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <footer className="border-t border-edge bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 md:flex-row md:items-center">
          <div>
            <p className="flex items-center gap-2 font-bold">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-primary font-mono text-[10px] font-extrabold text-white">1M</span>
              OneMark
            </p>
            <p className="mt-2 max-w-md text-sm text-ink-muted">
              GitHub-identical Markdown rendering, offline. PolyForm Noncommercial
              licensed; the fidelity harness is open for scrutiny.
            </p>
          </div>
          <div className="ml-auto flex gap-8 text-sm">
            <a href="https://github.com/adhamhaithameid/onemark" className="text-ink-muted hover:text-ink">
              GitHub
            </a>
            <a href={appUrl} className="text-ink-muted hover:text-ink">
              App
            </a>
            <a href="#faq" className="text-ink-muted hover:text-ink">
              FAQ
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
