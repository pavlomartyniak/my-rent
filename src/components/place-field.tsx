import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { PlaceList } from '@/app/car/pick';

import { openCatalogPicker } from '@/lib/catalog-picker';
import type { Place } from '@/lib/places';

import { PickerField } from './ui/picker-field';
import { PillButton } from './ui/pill-button';

/** Поле «Місто» у формі: відкриває список міст України з пошуком замість ручного вводу */
export function CityField({ value, onChange, error, label = 'Місто', clearable, inline }: { value: string; onChange: (city: string) => void; error?: string; label?: string; /** Необов'язкове поле: з'являється «Скинути» */ clearable?: boolean; /** Список відкривається у власному вікні, без окремого маршруту: потрібно в онбордингу, де маршрути екранів закриті */ inline?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
    <PickerField
      label={label}
      value={value}
      placeholder="Оберіть місто"
      error={error}
      onPress={() => (inline ? setOpen(true) : openCatalogPicker({ kind: 'place', allowRegion: false, selected: value, onSelect: (p) => onChange(p.city ?? '') }))}
    />
    {inline ? (
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <PlaceList request={{ kind: 'place', allowRegion: false, selected: value, onSelect: (p) => onChange(p.city ?? '') }} onClose={() => setOpen(false)} />
      </Modal>
    ) : null}
    {clearable && value ? (
      <View style={styles.reset}>
        <PillButton title="Скинути місто" icon="close" onPress={() => onChange('')} />
      </View>
    ) : null}
    </View>
  );
}

/** Фільтр за місцем у пошуку: місто або вся область; «Скинути» повертає всю Україну */
export function PlaceFilter({ value, onChange }: { value: Place | null; onChange: (place: Place | null) => void }) {
  return (
    <View style={styles.wrap}>
      <PickerField
        label="Місто або область"
        value={value?.label}
        placeholder="Уся Україна"
        onPress={() => openCatalogPicker({ kind: 'place', allowRegion: true, selected: value?.city, onSelect: onChange })}
      />
      {value ? (
        <View style={styles.reset}>
          <PillButton title="Скинути" icon="close" onPress={() => onChange(null)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  reset: { alignItems: 'flex-start' },
});
