// PARKO design system — modern clinical theme.
export const C = {
  primary: '#0B6E4F',
  primaryDark: '#084f39',
  primarySoft: '#E3F2EB',
  bg: '#F2F7F5',
  card: '#FFFFFF',
  ink: '#10231C',
  muted: '#5F7269',
  line: '#E2ECE8',
  danger: '#D64545',
  dangerSoft: '#FDECEC',
  warn: '#B7791F',
  warnSoft: '#FCF3DF',
  ok: '#1E9E6A',
  okSoft: '#E6F6EE',
  info: '#2D6CDF',
  infoSoft: '#E8F0FE',
  white: '#fff',
};

export const R = { sm: 10, md: 16, lg: 22 };

export const T = {
  h1: { fontSize: 26, fontWeight: '800', color: C.ink },
  h2: { fontSize: 19, fontWeight: '700', color: C.ink },
  h3: { fontSize: 15, fontWeight: '700', color: C.ink },
  body: { fontSize: 14, color: C.ink, lineHeight: 20 },
  muted: { fontSize: 13, color: C.muted, lineHeight: 18 },
  tiny: { fontSize: 11, color: C.muted },
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
