import { EmptyState, Screen } from '@/components/Screen';
import { useT } from '@/i18n';

/** Keep native expo-maps out of the web module graph. */
export default function WebMealMap() {
  const { t } = useT();
  return <Screen><EmptyState title={t.discover.mapTab} body={t.discover.webMapBody} /></Screen>;
}
