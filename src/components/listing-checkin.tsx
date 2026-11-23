import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { EVERY_OPTIONS, type ListingCheckin, WEEKDAY_OPTIONS } from '@/lib/checkin';
import { haptic } from '@/lib/haptics';

import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon, type IconName } from './ui/icon';
import { SwitchTabs } from './ui/switch-tabs';

const DEFAULT: ListingCheckin = { every: 'weekly', weekday: 1, body: true, interior: true };
const EVERY_LABELS = EVERY_OPTIONS.map((o) => o.label);
const WEEKDAY_ACCUSATIVE = ['у неділю', 'у понеділок', 'у вівторок', 'у середу', 'у четвер', 'у пʼятницю', 'у суботу'];

/**
 * Вимога фотозвіту в оголошенні. Згорнута, поки вимкнена: власнику, якому звіт не потрібен, вона нічого не додає. Коли ввімкнена,
 * орендар бачить умову ще до запиту, вона автоматично потрапляє в оренду й договір (власник може змінити її в самій оренді).
 */
export function ListingCheckinField({ value, onChange }: { value: ListingCheckin | null; onChange: (v: ListingCheckin | null) => void }) {
  const theme = useTheme();
  const on = !!value;
  const v = value ?? DEFAULT;
  const patch = (changes: Partial<ListingCheckin>) => onChange({ ...v, ...changes });

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.bubble, { backgroundColor: on ? theme.accentSoft : theme.backgroundSelected }]}>
          <Icon name="camera" size={18} color={on ? 'accent' : 'textSecondary'} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="default" style={styles.title}>
            Фотозвіт про авто
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {on ? 'Орендар знімає авто й надсилає фото та пробіг. Умову видно в оголошенні' : 'Необов’язково. Орендар регулярно надсилатиме фото та пробіг'}
          </ThemedText>
        </View>
        <Switch value={on} onValueChange={(next) => onChange(next ? DEFAULT : null)} trackColor={{ true: theme.accent }} />
      </View>

      {on ? (
        <View style={styles.body}>
          <SwitchTabs options={EVERY_LABELS} value={EVERY_OPTIONS.find((o) => o.value === v.every)!.label} onChange={(l) => patch({ every: EVERY_OPTIONS.find((o) => o.label === l)!.value })} />
          {v.every !== 'monthly' ? (
            <>
              <View style={styles.days}>
                {WEEKDAY_OPTIONS.map((d) => {
                  const sel = d.value === v.weekday;
                  return (
                    <Pressable
                      key={d.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: sel, checked: sel }}
                      accessibilityLabel={d.label}
                      onPress={() => {
                        haptic.select();
                        patch({ weekday: d.value });
                      }}
                      style={[styles.day, { backgroundColor: sel ? theme.ink : theme.backgroundSelected }]}>
                      <ThemedText type="smallBold" style={{ color: sel ? theme.onInk : theme.text }}>
                        {d.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {v.every === 'weekly' ? 'Щотижня' : 'Раз на два тижні'}, {WEEKDAY_ACCUSATIVE[v.weekday]}.
              </ThemedText>
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Щомісяця, у той самий день, коли почалась оренда.
            </ThemedText>
          )}
          <Item icon="speedometer-outline" title="Панель приладів із пробігом" locked />
          <Item icon="car-sport-outline" title="Кузов з усіх боків" value={v.body} onChange={(body) => patch({ body })} />
          <Item icon="people-outline" title="Салон" value={v.interior} onChange={(interior) => patch({ interior })} />
        </View>
      ) : null}
    </Card>
  );
}

function Item({ icon, title, value, onChange, locked }: { icon: IconName; title: string; value?: boolean; onChange?: (v: boolean) => void; locked?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.item}>
      <Icon name={icon} size={20} color="textSecondary" />
      <ThemedText type="default" style={styles.flex}>
        {title}
      </ThemedText>
      {locked ? (
        <View style={styles.locked}>
          <Icon name="lock-closed" size={13} color="textSecondary" />
          <ThemedText type="small" themeColor="textSecondary">
            Завжди
          </ThemedText>
        </View>
      ) : (
        <Switch value={!!value} onValueChange={onChange} trackColor={{ true: theme.accent }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  bubble: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  title: { fontWeight: 600 },
  body: { gap: Spacing.three },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  day: { flex: 1, aspectRatio: 1, maxWidth: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 40 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
