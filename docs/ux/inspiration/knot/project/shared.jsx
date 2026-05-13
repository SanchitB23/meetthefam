// Shared visual primitives: Avatar, PersonNode, Icon, Pill, etc.
// All components push themselves to window so other Babel scripts can use them.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ---------- Icons (line-style, 1.5px stroke) ----------
const Icon = ({ name, size = 18, stroke = 'currentColor', fill = 'none', strokeWidth = 1.6, style }) => {
  const paths = {
    plus: <path d="M12 5v14M5 12h14"/>,
    close: <path d="M6 6l12 12M18 6L6 18"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></>,
    home: <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2v-9z"/>,
    tree: <><path d="M12 21v-7"/><path d="M12 14c-3 0-5-2-5-5"/><path d="M12 14c3 0 5-2 5-5"/><circle cx="7" cy="9" r="2.2"/><circle cx="17" cy="9" r="2.2"/><circle cx="12" cy="4" r="2.2"/></>,
    people: <><circle cx="9" cy="9" r="3.2"/><circle cx="17" cy="10" r="2.6"/><path d="M3 19c.6-3 3-5 6-5s5.4 2 6 5"/><path d="M15 19c.4-2 2-3.5 4-3.5"/></>,
    book: <><path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 4v13a3 3 0 0 0 3 3"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></>,
    heart: <path d="M12 20s-7-4.5-9-9.5C1.5 6.5 5 3 8.5 5 10 5.8 11 7 12 8c1-1 2-2.2 3.5-3 3.5-2 7 1.5 5.5 5.5C19 15.5 12 20 12 20z"/>,
    chevron: <path d="M9 6l6 6-6 6"/>,
    chevDown: <path d="M6 9l6 6 6-6"/>,
    arrow: <><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></>,
    arrowL: <><path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/></>,
    photo: <><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="M21 17l-5-5-9 9"/></>,
    edit: <><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14 6l4 4"/></>,
    share: <><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 11l8-4M8 13l8 4"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="M3 3l18 18"/><path d="M10.6 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.3 4M6.6 6.6C3.6 8.5 2 12 2 12s3.5 7 10 7c1.6 0 3-.3 4.3-.8"/></>,
    lock: <><rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/></>,
    star: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.7 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>,
    map: <><path d="M9 3L3 5v16l6-2 6 2 6-2V3l-6 2z"/><path d="M9 3v16M15 5v16"/></>,
    calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>,
    list: <><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
    timeline: <><path d="M5 5v14"/><circle cx="5" cy="8" r="1.5"/><circle cx="5" cy="14" r="1.5"/><path d="M9 8h11M9 14h8"/></>,
    grid: <><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></>,
    plusS: <path d="M12 6v12M6 12h12"/>,
    minus: <path d="M5 12h14"/>,
    check: <path d="M5 12l5 5L20 7"/>,
    upload: <><path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></>,
    bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5z"/><path d="M10 21h4"/></>,
    bookmark: <path d="M6 4h12v17l-6-4-6 4z"/>,
    download: <><path d="M12 4v12M6 10l6 6 6-6"/><path d="M4 20h16"/></>,
    trash: <><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></>,
    link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7L11.5 7"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7L12.5 17"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></>,
    phone: <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>,
    leaf: <><path d="M5 19c0-9 7-15 15-15-1 9-7 15-15 15z"/><path d="M5 19l9-9"/></>,
    quote: <><path d="M7 8h4v4c0 3-2 5-5 5"/><path d="M14 8h4v4c0 3-2 5-5 5"/></>,
    branch: <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M6 8v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8M12 14v2"/></>,
    family: <><circle cx="8" cy="9" r="2.2"/><circle cx="16" cy="9" r="2.2"/><circle cx="12" cy="16" r="1.8"/><path d="M5 18c.5-2 1.5-3.5 3-4M19 18c-.5-2-1.5-3.5-3-4"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
         strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {paths[name]}
    </svg>
  );
};

// ---------- Gender-aware avatar shape ----------
// Classical genealogy: ◯ female, ▢ male, ◇ non-binary/other — softened to fit
// the warm wedding-card aesthetic. Toggleable via window.__VIZ.genderShape.
const radiusForGender = (size, gender) => {
  if (!window.__VIZ || window.__VIZ.genderShape === false) return '50%';
  if (gender === 'm') return Math.round(size * 0.18) + 'px'; // rounded square
  if (gender === 'n') return Math.round(size * 0.34) + 'px'; // squircle, in-between
  return '50%';                                              // f and unspecified: circle
};

// ---------- Avatar tile ----------
// Tone-tinted block w/ initials. Uses subtle paper texture via radial-gradient.
// Shape varies by gender; deceased people are gently desaturated.
const Avatar = ({ person, size = 56, ring = false, glow = false }) => {
  const tone = TONES[person.tone] || TONES.sage;
  const fontSize = Math.max(11, Math.round(size * 0.34));
  const radius = radiusForGender(size, person.gender);
  const isGone = !!person.died && (!window.__VIZ || window.__VIZ.markDeceased !== false);
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: `radial-gradient(circle at 30% 25%, ${tone.bg} 0%, ${shade(tone.bg, -8)} 100%)`,
      color: tone.ink,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Cormorant Garamond", serif', fontWeight: 600,
      fontSize, letterSpacing: '0.02em',
      boxShadow: ring
        ? `0 0 0 2px var(--paper), 0 0 0 ${size > 80 ? 4 : 3}px ${tone.ring}, 0 4px 14px rgba(60,40,20,.08)`
        : '0 1px 3px rgba(60,40,20,.08), inset 0 0 0 1px rgba(255,255,255,.4)',
      flexShrink: 0,
      position: 'relative',
      filter: isGone ? 'saturate(0.55)' : 'none',
      opacity:  isGone ? 0.82 : 1,
    }}>
      <span style={{ position: 'relative', zIndex: 1 }}>{person.initials}</span>
      {glow && <div style={{
        position: 'absolute', inset: -8, borderRadius: radius,
        boxShadow: `0 0 0 1px ${tone.ring}55`, pointerEvents: 'none',
      }}/>}
      {isGone && size >= 36 && (
        <div title="In memory of" style={{
          position: 'absolute', top: -2, right: -2,
          width: Math.max(14, Math.round(size * 0.26)),
          height: Math.max(14, Math.round(size * 0.26)),
          borderRadius: '50%',
          background: 'var(--paper)',
          color: 'var(--mid)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: '"Cormorant Garamond", serif',
          fontSize: Math.max(10, Math.round(size * 0.22)),
          fontWeight: 500,
          boxShadow: '0 1px 2px rgba(60,40,20,.18), inset 0 0 0 1px rgba(60,40,20,.10)',
          lineHeight: 1, paddingBottom: 1,
        }}>†</div>
      )}
    </div>
  );
};

// Decorative name prefix used everywhere a deceased person is shown.
const Memoriam = ({ person, color }) => {
  if (!person || !person.died) return null;
  if (window.__VIZ && window.__VIZ.markDeceased === false) return null;
  return (
    <span aria-label="In memory of" title={`In memory · ${person.died}`} style={{
      color: color || 'var(--mid)',
      marginRight: '.32em',
      fontWeight: 400,
      fontFamily: '"Cormorant Garamond", serif',
      letterSpacing: 0,
    }}>†</span>
  );
};

function shade(hex, percent) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + percent;
  let g = ((n >> 8) & 0xff) + percent;
  let b = (n & 0xff) + percent;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ---------- Person Node — used in tree view ----------
const PersonNode = ({ person, current, onClick, onAdd, compact, size = 'm' }) => {
  const tone = TONES[person.tone] || TONES.sage;
  const isUser = person.isUser;
  const isGone = !!person.died && (!window.__VIZ || window.__VIZ.markDeceased !== false);
  const w = size === 's' ? 132 : size === 'l' ? 188 : 158;
  return (
    <div onClick={onClick} style={{
      width: w, padding: '14px 12px 12px',
      background: isGone ? 'linear-gradient(180deg, var(--paper), rgba(60,40,20,.025))' : 'var(--paper)',
      borderRadius: 16,
      border: `1px solid ${current ? 'var(--ink)' : isGone ? 'rgba(60,40,20,.14)' : 'rgba(60,40,20,.08)'}`,
      boxShadow: current
        ? '0 0 0 3px rgba(45,74,62,.12), 0 8px 24px rgba(60,40,20,.10)'
        : '0 1px 2px rgba(60,40,20,.04), 0 4px 12px rgba(60,40,20,.05)',
      position: 'relative', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      transition: 'all .18s ease',
    }}
    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {isUser && (
        <div style={{
          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
          padding: '2px 10px', borderRadius: 999, background: 'var(--ink)',
          color: 'var(--paper)', fontSize: 10, letterSpacing: '0.12em',
          fontWeight: 600, textTransform: 'uppercase',
        }}>You</div>
      )}
      <Avatar person={person} size={size === 's' ? 44 : 56} ring={current}/>
      <div style={{
        marginTop: 8, fontFamily: '"Cormorant Garamond", serif', fontWeight: 600,
        fontSize: size === 's' ? 16 : 18, color: 'var(--ink)', textAlign: 'center',
        lineHeight: 1.1,
      }}><Memoriam person={person}/>{person.short || person.name.split(' ')[0]}</div>
      <div style={{
        marginTop: 3, fontSize: 10.5, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--mid)', fontWeight: 500,
      }}>{person.role}</div>
      {(person.born || person.died) && !compact && (
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--mid)', fontVariantNumeric: 'tabular-nums' }}>
          {person.born || '?'}{person.died ? ` – ${person.died}` : ''}
        </div>
      )}
      {onAdd && (
        <button onClick={(e) => { e.stopPropagation(); onAdd(person); }} style={{
          position: 'absolute', bottom: -10, right: -10,
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--accent)', color: '#fff', border: '2px solid var(--paper)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 4px 10px rgba(199,123,92,.35)',
        }} aria-label="Add relative">
          <Icon name="plusS" size={14} strokeWidth={2.4}/>
        </button>
      )}
    </div>
  );
};

// ---------- Pill / Chip ----------
const Pill = ({ children, tone = 'neutral', size = 'm', icon, onClick, active }) => {
  const tones = {
    neutral: { bg: 'rgba(60,40,20,.06)', fg: 'var(--ink)' },
    accent:  { bg: 'rgba(199,123,92,.12)', fg: '#8B4A2D' },
    green:   { bg: 'rgba(45,74,62,.10)', fg: 'var(--ink)' },
    ghost:   { bg: 'transparent', fg: 'var(--mid)' },
  };
  const t = tones[tone];
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: size === 's' ? '4px 10px' : '6px 12px',
      borderRadius: 999, border: active ? '1px solid var(--ink)' : '1px solid transparent',
      background: active ? 'var(--paper)' : t.bg, color: active ? 'var(--ink)' : t.fg,
      fontSize: size === 's' ? 11.5 : 12.5, fontWeight: 500,
      cursor: onClick ? 'pointer' : 'default',
      letterSpacing: '0.01em',
      boxShadow: active ? '0 1px 3px rgba(60,40,20,.06)' : 'none',
    }}>
      {icon && <Icon name={icon} size={13}/>}
      {children}
    </button>
  );
};

// ---------- Button ----------
const Button = ({ children, kind = 'primary', size = 'm', icon, iconRight, onClick, fullWidth, style }) => {
  const sizes = {
    s: { p: '7px 14px', fs: 12.5, ic: 14 },
    m: { p: '11px 20px', fs: 14, ic: 15 },
    l: { p: '15px 26px', fs: 15, ic: 17 },
  };
  const s = sizes[size];
  const kinds = {
    primary: {
      bg: 'var(--ink)', fg: 'var(--paper)', border: '1px solid var(--ink)',
      shadow: '0 1px 2px rgba(0,0,0,.05), 0 4px 14px rgba(45,74,62,.18)',
    },
    accent: {
      bg: 'var(--accent)', fg: '#fff', border: '1px solid var(--accent)',
      shadow: '0 1px 2px rgba(0,0,0,.05), 0 4px 14px rgba(199,123,92,.25)',
    },
    ghost: {
      bg: 'transparent', fg: 'var(--ink)', border: '1px solid rgba(60,40,20,.18)',
      shadow: 'none',
    },
    bare: {
      bg: 'transparent', fg: 'var(--ink)', border: '1px solid transparent',
      shadow: 'none',
    },
  };
  const k = kinds[kind];
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: s.p, fontSize: s.fs, fontWeight: 500, letterSpacing: '.005em',
      borderRadius: 999, border: k.border, background: k.bg, color: k.fg,
      boxShadow: k.shadow, cursor: 'pointer',
      width: fullWidth ? '100%' : 'auto',
      transition: 'transform .12s ease, box-shadow .12s ease',
      ...style,
    }}
    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(.98)'}
    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      {icon && <Icon name={icon} size={s.ic}/>}
      {children}
      {iconRight && <Icon name={iconRight} size={s.ic}/>}
    </button>
  );
};

// ---------- Card surface ----------
const Card = ({ children, padding = 24, style, onClick, hover }) => (
  <div onClick={onClick} style={{
    background: 'var(--paper)', borderRadius: 20,
    border: '1px solid rgba(60,40,20,.07)',
    boxShadow: '0 1px 2px rgba(60,40,20,.03), 0 8px 28px rgba(60,40,20,.05)',
    padding, cursor: onClick ? 'pointer' : 'default',
    transition: 'all .15s ease',
    ...(hover ? { ':hover': {} } : {}),
    ...style,
  }}>{children}</div>
);

// ---------- Decorative branch SVG ----------
const Branch = ({ flip, style, color = 'rgba(45,74,62,.18)' }) => (
  <svg viewBox="0 0 200 80" style={{ ...style, transform: flip ? 'scaleX(-1)' : 'none' }}
       preserveAspectRatio="none">
    <path d="M5 40 Q 60 10, 105 40 T 195 40" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <circle cx="105" cy="40" r="2.6" fill={color}/>
    <path d="M50 25 q 5 -8, 12 -6 q -3 6, -12 6 z" fill={color} opacity=".7"/>
    <path d="M150 55 q 5 8, 12 6 q -3 -6, -12 -6 z" fill={color} opacity=".7"/>
  </svg>
);

// ---------- Section header inside an artboard ----------
const ScreenChrome = ({ children, bg = 'var(--cream)', style }) => (
  <div style={{
    width: '100%', height: '100%', overflow: 'hidden',
    background: bg, color: 'var(--ink)',
    fontFamily: '"Manrope", system-ui, sans-serif',
    fontSize: 14, lineHeight: 1.5,
    ...style,
  }}>{children}</div>
);

Object.assign(window, {
  Icon, Avatar, PersonNode, Memoriam, Pill, Button, Card, Branch, ScreenChrome, shade,
});
