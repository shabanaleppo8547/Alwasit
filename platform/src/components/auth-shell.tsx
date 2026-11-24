export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="page flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-md animate-rise">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-6 text-ink-soft">{subtitle}</p>}
        </div>
        <div className="card p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
