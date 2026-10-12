import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpsklTheme, Button } from '@opskil/design-system';

export default function NotFoundScreen() {
  const router = useRouter();
  const { colors, spacing, typography } = useOpsklTheme();

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
      }}
    >
      <Text style={{ fontSize: 40, marginBottom: spacing.md }}>🔍</Text>
      <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
        Screen Not Found
      </Text>
      <Text
        style={[
          typography.body,
          { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
        ]}
      >
        This link doesn't exist or has been removed.
      </Text>
      <Button
        title="Return to Shifts"
        variant="primary"
        size="md"
        fullWidth={false}
        onPress={() => router.replace('/' as any)}
      />
    </SafeAreaView>
  );
}
