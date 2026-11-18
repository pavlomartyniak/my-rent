import { Redirect, useLocalSearchParams } from 'expo-router';

/** Аналітика авто — не окремий екран, а фільтр розділу «Доходи» */
export default function CarAnalyticsRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/analytics', params: { carId: id } }} />;
}
