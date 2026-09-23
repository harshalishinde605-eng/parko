import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T, SH, STATUS_STYLE } from './theme';

export function Screen({ children, refreshing, onRefresh, pad = 16 }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: pad, paddingBottom: 32 }}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.primary} /> : undefined
        }
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Btn({ title, onPress, kind = 'primary', loading, disabled, style }) {
  const styles = {
    primary: { bg: C.primary, fg: C.white },
    dark: { bg: C.ink, fg: C.white },
    secondary: { bg: C.primarySoft, fg: C.primaryDark },
    danger: { bg: C.danger, fg: C.white },
    ghost: { bg: 'transparent', fg: C.primary },
  }[kind];
  const off = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      activeOpacity={0.75}
      style={[s.btn, { backgroundColor: styles.bg, opacity: off ? 0.6 : 1 }, kind === 'ghost' && s.btnGhost, style]}
    >
      {loading ? (
        <ActivityIndicator color={kind === 'primary' || kind === 'danger' || kind === 'dark' ? C.white : C.primary} />
      ) : (
        <Text style={[s.btnT, { color: styles.fg }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Field({ label, error, secure, ...props }) {
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View style={{ marginBottom: 12 }}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <View style={[s.inputWrap, error && { borderColor: C.danger }]}>
        <TextInput
          style={s.input}
          placeholderTextColor="#9AA9A2"
          secureTextEntry={hidden}
          {...props}
        />
        {secure && (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} style={s.eye}>
            <Text style={{ color: C.primary, fontWeight: '700' }}>{hidden ? 'Show' : 'Hide'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={s.err}>{error}</Text>}
    </View>
  );
}

export function PickerField({ label, value, onChange, items, error }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <View style={[s.inputWrap, { paddingHorizontal: 4 }, error && { borderColor: C.danger }]}>
        <Picker selectedValue={value} onValueChange={onChange} style={{ flex: 1 }}>
          {items.map((it) => (
            <Picker.Item key={String(it.value)} label={it.label} value={it.value} />
          ))}
        </Picker>
      </View>
      {!!error && <Text style={s.err}>{error}</Text>}
    </View>
  );
}

export function Seg({ options, value, onChange }) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <TouchableOpacity
          key={String(o.value)}
          onPress={() => onChange(o.value)}
          style={[s.segOpt, value === o.value && s.segOn]}
        >
          <Text style={[s.segT, value === o.value && s.segTOn]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function Chip({ status }) {
  const st = STATUS_STYLE[status] || STATUS_STYLE.info;
  return (
    <View style={[s.chip, { backgroundColor: st.bg }]}>
      <Text style={[s.chipT, { color: st.fg }]}>{st.label}</Text>
    </View>
  );
}

export function Bar({ pct, color = C.primary }) {
  return (
    <View style={s.barBg}>
      <View style={[s.barFg, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Row({ children, between }) {
  return <View style={[s.row, between && { justifyContent: 'space-between' }]}>{children}</View>;
}

export function Title({ children, sub }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={T.h1}>{children}</Text>
      {!!sub && <Text style={[T.muted, { marginTop: 4 }]}>{sub}</Text>}
    </View>
  );
}

export function SectionTitle({ children }) {
  return <Text style={[T.h2, { marginTop: 18, marginBottom: 10 }]}>{children}</Text>;
}

export function Banner({ kind = 'danger', children }) {
  const bg = kind === 'danger' ? C.dangerSoft : kind === 'warn' ? C.warnSoft : C.okSoft;
  const fg = kind === 'danger' ? C.danger : kind === 'warn' ? C.warn : C.ok;
  return (
    <View style={[s.banner, { backgroundColor: bg, borderColor: fg }]}>
      <Text style={{ color: fg, fontSize: 13, lineHeight: 18 }}>{children}</Text>
    </View>
  );
}

export function Empty({ children }) {
  return (
    <View style={s.empty}>
      <Text style={T.muted}>{children}</Text>
    </View>
  );
}

export function Loader({ children = 'Loading…' }) {
  return (
    <View style={s.empty}>
      <ActivityIndicator color={C.primary} size="large" />
      <Text style={[T.muted, { marginTop: 8 }]}>{children}</Text>
    </View>
  );
}

const LEVEL = {
  red: { bg: C.dangerSoft, fg: C.danger, icon: 'alert-circle' },
  amber: { bg: C.warnSoft, fg: C.warn, icon: 'warning' },
  green: { bg: C.okSoft, fg: C.ok, icon: 'checkmark-circle' },
  info: { bg: C.infoSoft, fg: C.info, icon: 'information-circle' },
};

export function AttentionItem({ level = 'info', title, detail, sub, onPress }) {
  const L = LEVEL[level] || LEVEL.info;
  const body = (
    <View style={[s.att, { backgroundColor: L.bg, borderColor: L.fg }]}>
      <Ionicons name={L.icon} size={22} color={L.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {!!sub && <Text style={[T.tiny, { color: L.fg, fontWeight: '700' }]}>{sub}</Text>}
        <Text style={[T.body, { fontWeight: '700' }]}>{title}</Text>
        {!!detail && <Text style={T.muted}>{detail}</Text>}
      </View>
      {!!onPress && <Ionicons name="chevron-forward" size={20} color={L.fg} />}
    </View>
  );
  if (!onPress) return body;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{body}</TouchableOpacity>;
}

export function Dots({ values = [], labels }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <View style={s.dots}>
      {values.map((v, i) => (
        <View key={i} style={s.dotCol}>
          <View style={[s.dot, { backgroundColor: v ? C.primary : '#DCE7E2' }]}>
            {v ? <Ionicons name="checkmark" size={12} color={C.white} /> : null}
          </View>
          <Text style={T.tiny}>{(labels || days)[i % 7]}</Text>
        </View>
      ))}
    </View>
  );
}

export function MiniBars({ bars = [], color = C.primary, height = 72 }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <View style={[s.mbars, { height: height + 20 }]}>
      {bars.map((b, i) => (
        <View key={i} style={s.mbarCol}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={{ height: Math.max(3, (b.value / max) * height), backgroundColor: b.color || color, borderRadius: 4 }} />
          </View>
          <Text style={T.tiny}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function BigButton({ title, sub, icon = 'flash', onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={s.big}>
      <Ionicons name={icon} size={30} color={C.white} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.white, fontSize: 17, fontWeight: '800' }}>{title}</Text>
        {!!sub && <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{sub}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={22} color={C.white} />
    </TouchableOpacity>
  );
}

export function Hero({ kicker, title, sub, right }) {
  return (
    <View style={s.hero}>
      <View style={{ flex: 1 }}>
        {!!kicker && <Text style={s.heroKicker}>{kicker}</Text>}
        <Text style={T.heroTitle}>{title}</Text>
        {!!sub && <Text style={[T.heroSub, { marginTop: 4 }]}>{sub}</Text>}
      </View>
      {!!right && <View style={s.heroRight}>{right}</View>}
    </View>
  );
}

export function StatTile({ value, label, color = C.ink, bg = C.card, sub }) {
  return (
    <View style={[s.tile, { backgroundColor: bg }, SH.card]}>
      <Text style={[T.h1, { color }]}>{value}</Text>
      <Text style={[T.tiny, { fontWeight: '700' }]}>{label}</Text>
      {!!sub && <Text style={T.tiny}>{sub}</Text>}
    </View>
  );
}

export function SectionHead({ title, action, onAction }) {
  return (
    <View style={[s.row, { justifyContent: 'space-between', marginTop: 18, marginBottom: 10 }]}>
      <Text style={T.h2}>{title}</Text>
      {!!action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={{ color: C.primary, fontWeight: '700', fontSize: 13 }}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: R.md, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.line, ...SH.card },
  btn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  btnGhost: { borderWidth: 1, borderColor: C.primary },
  btnT: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrap: {
    backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: C.ink },
  eye: { paddingHorizontal: 12, paddingVertical: 10 },
  err: { color: C.danger, fontSize: 12, marginTop: 4 },
  seg: { flexDirection: 'row', backgroundColor: '#E7EFEB', borderRadius: 12, padding: 4, marginBottom: 12 },
  segOpt: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segOn: { backgroundColor: C.white, elevation: 1 },
  segT: { fontSize: 13, fontWeight: '600', color: C.muted },
  segTOn: { color: C.primaryDark },
  chip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  chipT: { fontSize: 12, fontWeight: '700' },
  barBg: { height: 8, backgroundColor: '#E7EFEB', borderRadius: 6, overflow: 'hidden', marginTop: 6 },
  barFg: { height: 8, borderRadius: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  empty: { padding: 24, alignItems: 'center' },
  att: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8, alignItems: 'flex-start' },
  dots: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  dotCol: { alignItems: 'center', gap: 4 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  mbars: { flexDirection: 'row', gap: 6, marginTop: 8 },
  mbarCol: { flex: 1, alignItems: 'center', gap: 4 },
  big: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.primary, borderRadius: 16, padding: 16, marginBottom: 12, ...SH.card },
  hero: { backgroundColor: C.primaryDeep, borderRadius: R.lg, padding: 18, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...SH.card },
  heroKicker: { color: C.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  heroRight: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  tile: { flex: 1, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.line },
});
