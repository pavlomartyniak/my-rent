import { Redirect, useLocalSearchParams } from 'expo-router';

/** Аналітика оренди — не окремий екран, а фільтр розділу «Доходи» */
export default function DealAnalyticsRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/renter/report', params: { dealId: id } }} />;
}
