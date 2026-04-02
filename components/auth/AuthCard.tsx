export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[440px] bg-card rounded-[20px] border border-brand shadow-[0_4px_24px_rgba(0,0,0,0.06)] px-8 py-9">
      {children}
    </div>
  )
}

export function AuthBrand() {
  return (
    <div className="flex items-center gap-2 mb-7">
      <div className="w-8 h-8 bg-accent-light rounded-[9px] flex items-center justify-center shrink-0">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 22V12h6v10"
            stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span className="text-[15px] font-bold text-title-brand">
        해한<span className="text-accent">AI</span> 출퇴근
      </span>
    </div>
  )
}

export function AuthTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-7">
      <h2 className="text-[22px] font-bold text-fore-brand mb-1.5 leading-snug">{title}</h2>
      <p className="text-[13px] text-muted-brand leading-relaxed">{description}</p>
    </div>
  )
}

export function AuthInput({
  id, label, type = 'text', value, onChange, placeholder, autoComplete,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-[13px] font-semibold text-body-brand mb-[6px]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-4 text-[15px] text-fore-brand bg-card border border-brand rounded-[10px] outline-none placeholder:text-muted2-brand focus:border-accent focus:ring-2 focus:ring-[rgba(249,115,22,0.12)] transition-colors"
      />
    </div>
  )
}

export function AuthPrimaryBtn({
  children, onClick, disabled = false,
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full h-12 text-[15px] font-semibold text-white bg-brand-accent hover:bg-brand-accent-hover active:bg-[#C2410C] rounded-[12px] transition-colors shadow-[0_2px_10px_rgba(249,115,22,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="mb-5 rounded-[10px] px-4 py-3 text-[13px] text-status-rejected bg-red-light border border-red">
      {message}
    </div>
  )
}

export function AuthFooter({ links }: { links: { label: string; href: string }[] }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      {links.map((l) => (
        <a key={l.href} href={l.href}
          className="text-[13px] text-muted-brand hover:text-accent transition-colors py-0.5 no-underline">
          {l.label}
        </a>
      ))}
    </div>
  )
}
