export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold text-blue-400">Observability Platform</h1>
      </div>
      
      <div className="relative flex place-items-center">
        <p className="text-xl text-slate-300">
          Dashboard Shell Placeholder - Full observability metrics & AI insights coming soon.
        </p>
      </div>

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:grid-cols-4 lg:text-left gap-4">
        <div className="group rounded-lg border border-slate-700 px-5 py-4 transition-colors hover:border-blue-500 hover:bg-slate-800/50">
          <h2 className="mb-3 text-2xl font-semibold">Servers &rarr;</h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-70">Monitor node & container health in real-time.</p>
        </div>
        <div className="group rounded-lg border border-slate-700 px-5 py-4 transition-colors hover:border-blue-500 hover:bg-slate-800/50">
          <h2 className="mb-3 text-2xl font-semibold">Incidents &rarr;</h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-70">Correlated root-cause anomaly detection.</p>
        </div>
        <div className="group rounded-lg border border-slate-700 px-5 py-4 transition-colors hover:border-blue-500 hover:bg-slate-800/50">
          <h2 className="mb-3 text-2xl font-semibold">Logs & Metrics &rarr;</h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-70">Prometheus and Loki data streams.</p>
        </div>
        <div className="group rounded-lg border border-slate-700 px-5 py-4 transition-colors hover:border-blue-500 hover:bg-slate-800/50">
          <h2 className="mb-3 text-2xl font-semibold">AI Assistant &rarr;</h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-70">RAG + Gemini smart diagnostic assistant.</p>
        </div>
      </div>
    </main>
  );
}
