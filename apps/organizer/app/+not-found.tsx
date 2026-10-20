import { useRouter } from 'expo-router';
import { useOpsklTheme, EmptyState, Screen } from '@opskil/design-system';
import { Search } from 'lucide-react-native';

export default function NotFoundScreen() {
  const router = useRouter();
  const { colors, spacing, iconSizes } = useOpsklTheme();

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      contentStyle={{ justifyContent: 'center', padding: spacing.xl }}
    >
      <EmptyState
        icon={<Search size={iconSizes.xxl} color={colors.textMuted} strokeWidth={2} />}
        title="Screen Not Found"
        description="This organizer page doesn't exist or has moved."
        actionLabel="Return to Dashboard"
        onAction={() => router.replace('/' as any)}
      />
    </Screen>
  );
}
