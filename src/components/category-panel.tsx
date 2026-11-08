import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import type { CategoryShare } from '@/lib/reports';

import { CategoryBreakdown } from './category-breakdown';
import { PeriodSwitcher, usePeriod } from './period-switcher';
import { ReportStatus } from './report-status';
import { ThemedText } from './themed-text';

/**
 * Витрати за категоріями з власним вибором періоду (місяць, рік чи весь час): блок сам завантажує дані за вибраний період,
 * тож окремого блоку «за весь час» не потрібно. `carId` чи `dealId` звужують вибірку до одного авто чи однієї оренди.
 */
export function CategoryPanel({ carId, dealId, title }: { carId?: string; dealId?: string; /** Заголовок усередині картки, коли блок стоїть у власній картці */ title?: string }) {
  const p = usePeriod();
  const query = `period=${p.key}${carId ? `&carId=${carId}` : ''}${dealId ? `&dealId=${dealId}` : ''}`;
  const { data, loading, error, retry } = useReport<{ categories: CategoryShare[] }>(`/reports/categories?${query}`, { keepPrevious: true });

  return (
    <View style={styles.wrap}>
      {title ? (
        <ThemedText type="default" style={styles.title}>
          {title}
        </ThemedText>
      ) : null}
      <PeriodSwitcher state={p} />
      {data ? <CategoryBreakdown items={data.categories} /> : <ReportStatus loading={loading} error={error} onRetry={retry} />}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: Spacing.four }, title: { fontWeight: 700, fontSize: 18 } });
