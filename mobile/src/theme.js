// PARKO design system v2 — deep clinical modern theme.
export const C = {
  primary: '#0B6E4F',
  primaryDark: '#084f39',
  primaryDeep: '#053527',
  primarySoft: '#E3F2EB',
  accent: '#E8A838',
  accentSoft: '#FBF1DC',
  bg: '#EEF4F1',
  card: '#FFFFFF',
  ink: '#0E211A',
  inkSoft: '#2A4439',
  muted: '#5F7269',
  line: '#DEE9E3',
  danger: '#D64545',
  dangerSoft: '#FDECEC',
  warn: '#B7791F',
  warnSoft: '#FCF3DF',
  ok: '#1E9E6A',
  okSoft: '#E6F6EE',
  info: '#2D6CDF',
  infoSoft: '#E8F0FE',
  violet: '#6C4FD8',
  violetSoft: '#ECE7FB',
  white: '#fff',
};

export const R = { sm: 10, md: 16, lg: 24, xl: 30 };

export const T = {
  display: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: '800', color: C.ink, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '700', color: C.ink },
  h3: { fontSize: 15, fontWeight: '700', color: C.ink },
  body: { fontSize: 14, color: C.ink, lineHeight: 20 },
  muted: { fontSize: 13, color: C.muted, lineHeight: 18 },
  tiny: { fontSize: 11, color: C.muted },
  heroTitle: { fontSize: 24, fontWeight: '800', color: C.white, letterSpacing: -0.3 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 18 },
};

export const SH = {
  card: {
    shadowColor: '#0B3D2C',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
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
