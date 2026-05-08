// ui.jsx — Shared UI primitives, dialog, toast, icons

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── Icons (inline SVG, stroke-based) ───────────────────────────
const Icon = {
  back: (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 18l-6-6 6-6"/></svg>,
  plus: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  check: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6L9 17l-5-5"/></svg>,
  pencil: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  trash: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"/></svg>,
  drag: (p) => <svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor" {...p}><circle cx="5" cy="4" r="1.6"/><circle cx="11" cy="4" r="1.6"/><circle cx="5" cy="10" r="1.6"/><circle cx="11" cy="10" r="1.6"/><circle cx="5" cy="16" r="1.6"/><circle cx="11" cy="16" r="1.6"/></svg>,
  link: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  cake: (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 21v-8a2 2 0 00-2-2H6a2 2 0 00-2 2v8"/><path d="M4 16s1.5-2 4-2 4 2 4 2 1.5-2 4-2 4 2 4 2"/><path d="M2 21h20"/><path d="M7 8v3M12 8v3M17 8v3"/></svg>,
  gift: (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 100-5C13 2 12 7 12 7z"/></svg>,
  users: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  settings: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  home: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  euro: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 10h12M4 14h12"/><path d="M19 6.5A8 8 0 0010 6c-3.3 0-6 2.7-6 6s2.7 6 6 6a8 8 0 009-.5"/></svg>,
  lock: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  x: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6L6 18M6 6l12 12"/></svg>,
  chev: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 18l6-6-6-6"/></svg>,
  sparkle: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M19 14l.7 1.9L21.6 17l-1.9.7L19 19.6l-.7-1.9L16.4 17l1.9-.7z"/></svg>,
  search: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>,
  party: (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5.8 11.3l2 5.5L21 14l-9-9-1.5 6.4-3.7-1.1z"/><path d="M4 22l1.6-1.6"/><path d="M11 14l-2.5-2.5"/></svg>,
  vote: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  mail: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  moon: (p) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
};

// ── Avatar ──────────────────────────────────────────────────────
function Avatar({ person, size = 36, ring = false, dark = false }) {
  if (!person) return null;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: person.color,
      color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 600, fontSize: size * 0.38,
      letterSpacing: 0.3,
      boxShadow: ring ? `0 0 0 2px ${dark ? '#1c1917' : '#FAFAF9'}, 0 0 0 ${size > 30 ? 4 : 3}px ${person.color}` : 'none',
      flexShrink: 0,
    }}>{initials(person.name)}</div>
  );
}

// ── Button ─────────────────────────────────────────────────────
function Button({ variant = 'primary', size = 'md', children, dark, style, ...p }) {
  const sizes = {
    sm: { padding: '8px 12px', fontSize: 14, minHeight: 36 },
    md: { padding: '12px 18px', fontSize: 15, minHeight: 44 },
    lg: { padding: '14px 22px', fontSize: 16, minHeight: 50 },
  };
  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
      color: '#fff',
      border: 'none',
      boxShadow: '0 6px 16px -4px rgba(249,115,22,0.45), 0 1px 0 rgba(255,255,255,0.3) inset',
    },
    secondary: {
      background: dark ? '#292524' : '#fff',
      color: dark ? '#FAFAF9' : '#1C1917',
      border: dark ? '1px solid #44403C' : '1px solid #E7E5E4',
    },
    ghost: {
      background: 'transparent',
      color: dark ? '#FAFAF9' : '#1C1917',
      border: 'none',
    },
    danger: {
      background: dark ? '#7F1D1D' : '#FEE2E2',
      color: dark ? '#FECACA' : '#B91C1C',
      border: 'none',
    },
  };
  return (
    <button {...p} style={{
      borderRadius: 14, fontWeight: 600, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      transition: 'transform 0.1s, box-shadow 0.15s, opacity 0.15s',
      WebkitTapHighlightColor: 'transparent',
      ...sizes[size], ...variants[variant], ...style,
    }}>{children}</button>
  );
}

// ── Card ───────────────────────────────────────────────────────
function Card({ children, dark, style, ...p }) {
  return (
    <div {...p} style={{
      background: dark ? '#292524' : '#FFFFFF',
      borderRadius: 20,
      border: dark ? '1px solid #3A3633' : '1px solid #F0EBE6',
      boxShadow: dark ? '0 1px 0 rgba(255,255,255,0.04) inset' : '0 1px 2px rgba(28,25,23,0.04), 0 4px 14px -8px rgba(28,25,23,0.08)',
      ...style,
    }}>{children}</div>
  );
}

// ── Chip ───────────────────────────────────────────────────────
function Chip({ children, variant = 'neutral', dark, style, onClick }) {
  const variants = {
    neutral: dark ? { bg: '#3A3633', fg: '#E7E5E4' } : { bg: '#F5F1ED', fg: '#57534E' },
    accent: { bg: dark ? '#451A03' : '#FEF3C7', fg: dark ? '#FCD34D' : '#92400E' },
    success: { bg: dark ? '#14532D' : '#DCFCE7', fg: dark ? '#86EFAC' : '#166534' },
    info: { bg: dark ? '#1E3A8A' : '#DBEAFE', fg: dark ? '#93C5FD' : '#1E40AF' },
  };
  const v = variants[variant];
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 600,
      background: v.bg, color: v.fg,
      cursor: onClick ? 'pointer' : 'default',
      letterSpacing: 0.1,
      ...style,
    }}>{children}</span>
  );
}

// ── Dialog (modal sheet) ───────────────────────────────────────
function Dialog({ open, onClose, title, children, dark, footer }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease-out',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'relative', width: '100%',
        background: dark ? '#1C1917' : '#FAFAF9',
        borderRadius: '24px 24px 0 0',
        animation: 'slideUp 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
        maxHeight: '85%', display: 'flex', flexDirection: 'column',
        paddingBottom: 34,
      }}>
        <div style={{
          padding: '12px 0 8px', display: 'flex', justifyContent: 'center',
        }}>
          <div style={{ width: 36, height: 5, borderRadius: 99, background: dark ? '#44403C' : '#D6D3D1' }} />
        </div>
        {title && (
          <div style={{
            padding: '6px 22px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: dark ? '#FAFAF9' : '#1C1917' }}>{title}</h3>
            <button onClick={onClose} style={{
              background: dark ? '#292524' : '#F5F1ED', border: 'none',
              borderRadius: '50%', width: 32, height: 32, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: dark ? '#A8A29E' : '#78716C',
            }}><Icon.x/></button>
          </div>
        )}
        <div style={{ padding: '4px 22px 18px', overflow: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: '10px 22px 0', borderTop: dark ? '1px solid #292524' : '1px solid #F0EBE6' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Input ──────────────────────────────────────────────────────
function Input({ dark, style, label, ...p }) {
  return (
    <div>
      {label && (
        <label style={{
          display: 'block', fontSize: 13, fontWeight: 600,
          color: dark ? '#A8A29E' : '#78716C', marginBottom: 6, paddingLeft: 2,
        }}>{label}</label>
      )}
      <input {...p} style={{
        width: '100%', boxSizing: 'border-box',
        padding: '12px 14px', fontSize: 15,
        borderRadius: 12,
        border: dark ? '1px solid #44403C' : '1px solid #E7E5E4',
        background: dark ? '#1C1917' : '#FFFFFF',
        color: dark ? '#FAFAF9' : '#1C1917',
        outline: 'none',
        fontFamily: 'inherit',
        ...style,
      }}/>
    </div>
  );
}

// ── Toast (sonner-style) ───────────────────────────────────────
const ToastContext = React.createContext({ toast: () => {} });
function ToastProvider({ children, dark }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, opts = {}) => {
    const id = Math.random();
    setToasts(t => [...t, { id, msg, kind: opts.kind || 'success' }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{
        position: 'absolute', bottom: 80, left: 0, right: 0, zIndex: 300,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: dark ? '#292524' : '#1C1917',
            color: '#FAFAF9',
            padding: '11px 16px', borderRadius: 14,
            fontSize: 14, fontWeight: 500,
            boxShadow: '0 12px 32px -8px rgba(0,0,0,0.35)',
            animation: 'toastIn 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
            display: 'flex', alignItems: 'center', gap: 8,
            maxWidth: '85%',
          }}>
            <span style={{ color: t.kind === 'error' ? '#FCA5A5' : '#86EFAC' }}>
              {t.kind === 'error' ? '⚠' : <Icon.check/>}
            </span>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
const useToast = () => React.useContext(ToastContext).toast;

// ── Identity chip (top-right) ──────────────────────────────────
function IdentityChip({ person, onClick, dark }) {
  if (!person) {
    return (
      <button onClick={onClick} style={{
        background: dark ? '#292524' : '#fff',
        border: dark ? '1px solid #44403C' : '1px solid #E7E5E4',
        borderRadius: 999, padding: '6px 12px 6px 8px',
        display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
        fontSize: 12, fontWeight: 600,
        color: dark ? '#FCD34D' : '#B45309',
      }}>
        <span style={{ fontSize: 14 }}>👋</span> Wer bist du?
      </button>
    );
  }
  return (
    <button onClick={onClick} style={{
      background: dark ? '#292524' : '#fff',
      border: dark ? '1px solid #44403C' : '1px solid #E7E5E4',
      borderRadius: 999, padding: '4px 12px 4px 4px',
      display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
      boxShadow: '0 1px 2px rgba(28,25,23,0.04)',
    }}>
      <Avatar person={person} size={26}/>
      <span style={{ fontSize: 12, fontWeight: 600, color: dark ? '#E7E5E4' : '#44403C' }}>
        Ich: {person.name}
      </span>
    </button>
  );
}

// ── Page header (back arrow + title + actions) ─────────────────
function PageHeader({ onBack, title, subtitle, right, dark, sticky = true }) {
  return (
    <div style={{
      position: sticky ? 'sticky' : 'relative', top: 0, zIndex: 30,
      background: dark
        ? 'linear-gradient(to bottom, #1C1917 80%, rgba(28,25,23,0))'
        : 'linear-gradient(to bottom, #FAFAF9 80%, rgba(250,250,249,0))',
      padding: '12px 18px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36 }}>
        {onBack && (
          <button onClick={onBack} style={{
            background: dark ? '#292524' : '#fff',
            border: dark ? '1px solid #3A3633' : '1px solid #E7E5E4',
            borderRadius: '50%', width: 36, height: 36, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: dark ? '#FAFAF9' : '#1C1917', flexShrink: 0,
          }}><Icon.back/></button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 700,
            color: dark ? '#FAFAF9' : '#1C1917',
            letterSpacing: -0.4,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{title}</h1>}
          {subtitle && <div style={{
            fontSize: 13, color: dark ? '#A8A29E' : '#78716C', marginTop: 2, fontWeight: 500,
          }}>{subtitle}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────
function EmptyState({ emoji, title, subtitle, action, dark }) {
  return (
    <div style={{
      padding: '40px 24px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      <div style={{ fontSize: 44, marginBottom: 6, filter: 'saturate(0.9)' }}>{emoji}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: dark ? '#FAFAF9' : '#1C1917' }}>{title}</div>
      {subtitle && <div style={{
        fontSize: 13, color: dark ? '#A8A29E' : '#78716C', maxWidth: 260, lineHeight: 1.5,
      }}>{subtitle}</div>}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}

// ── Confetti (simple, lazy) ───────────────────────────────────
function Confetti({ active }) {
  if (!active) return null;
  const dots = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: `${(i * 7 + 5) % 100}%`,
    delay: (i * 0.18) % 3,
    color: ['#F59E0B', '#F97316', '#EC4899', '#8B5CF6', '#06B6D4'][i % 5],
    size: 4 + (i % 3) * 2,
  })), []);
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
      borderRadius: 'inherit',
    }}>
      {dots.map((d, i) => (
        <div key={i} style={{
          position: 'absolute', top: -10, left: d.left,
          width: d.size, height: d.size * 1.4, background: d.color,
          borderRadius: 1, opacity: 0.7,
          animation: `confettiFall 3.4s linear ${d.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

Object.assign(window, {
  Icon, Avatar, Button, Card, Chip, Dialog, Input,
  ToastProvider, useToast, IdentityChip, PageHeader, EmptyState, Confetti,
});
