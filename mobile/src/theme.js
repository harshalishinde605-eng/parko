// PARKO design system v3 — clinical reference spec.
// Deep forest green + emerald actions + mint surfaces + warm off-white bg.
export const C = {
  primary: '#063F32',
  action: '#087A5A',
  primaryDark: '#063F32',
  primaryDeep: '#063F32',
  primarySoft: '#E2F1EB',
  accent: '#E8A838',
  accentSoft: '#FBF1DC',
  bg: '#F5F7F3',
  card: '#FFFFFF',
  cardTint: '#F2F7F3',
  ink: '#10231D',
  inkSoft: '#2A4439',
  muted: '#66756F',
  line: '#E3EAE4',
  danger: '#C93E3E',
  dangerSoft: '#FDECEC',
  warn: '#B7791F',
  warnSoft: '#FCF3DF',
  ok: '#087A5A',
  okSoft: '#E2F1EB',
  info: '#2D6CDF',
  infoSoft: '#E8F0FE',
  violet: '#6C4FD8',
  violetSoft: '#ECE7FB',
  white: '#fff',
};

// Spacing scale: 8 / 12 / 16 / 20 / 24 / 32
export const S = { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 };
export const R = { sm: 10, md: 20, lg: 26, xl: 32 };

export const T = {
  display: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: '800', color: C.ink, letterSpacing: -0.3 },
  h2: { fontSize: 22, fontWeight: '700', color: C.ink },
  h3: { fontSize: 18, fontWeight: '700', color: C.ink },
  cardTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  body: { fontSize: 15, color: C.ink, lineHeight: 22 },
  muted: { fontSize: 13, color: C.muted, lineHeight: 18 },
  tiny: { fontSize: 12, color: C.muted },
  label: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 0.5 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: C.white, letterSpacing: -0.3 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  eyebrow: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.75)', letterSpacing: 1.5, textTransform: 'uppercase' },
};

export const SH = {
  card: {
    shadowColor: '#063F32',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
};

export const STATUS_STYLE = {
  completed: { bg: C.okSoft, fg: C.ok, label: 'Completed' },
  taken: { bg: C.okSoft, fg: C.ok, label: 'Taken' },
  partial: { bg: C.warnSoft, fg: C.warn, label: 'Partial' },
  delayed: { bg: C.warnSoft, fg: C.warn, label: 'Delayed' },
  missed: { bg: C.dangerSoft, fg: C.danger, label: 'Missed' },
  critical: { bg: C.dangerSoft, fg: C.danger, label: 'Critical' },
  warning: { bg: C.warnSoft, fg: C.warn, label: 'Warning' },
  info: { bg: C.infoSoft, fg: C.info, label: 'Info' },
};
