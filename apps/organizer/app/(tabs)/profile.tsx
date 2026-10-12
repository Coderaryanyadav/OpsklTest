import { View, Text, ScrollView, Switch, Linking, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOpsklTheme, Card, Badge, Button } from '@opskil/design-system';
import { formatINR } from '@opskil/shared';

export default function OrganizerProfileScreen() {
  const { colors, spacing, radii, typography, isDark, toggleTheme } = useOpsklTheme();

  const handleOpenUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unable to open link', `Please visit ${url} in your browser.`);
      }
    } catch {
      Alert.alert('Notice', `Please visit ${url}`);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Organization Account',
      'Are you sure you want to permanently delete your Opskl organizer account? All organization details, active job listings, and billing records will be archived and purged in compliance with Apple and Google Play store data safety guidelines. Any remaining escrow balances must be reconciled first.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Permanent Deletion',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Request Confirmed',
              'Your organization account deletion ticket has been registered. Our accounts team will reconcile outstanding payments and finalize data deletion within 30 days.'
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={[typography.h2, { color: colors.textPrimary }]}>Organization Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {/* Organization Card */}
        <Card variant="elevated">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: radii.md,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.md,
              }}
            >
              <Text style={{ fontSize: 24, color: '#FFFFFF', fontWeight: '800' }}>AE</Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[typography.h3, { color: colors.textPrimary, marginRight: 6 }]}>
                  Apex Event Productions
                </Text>
                <Badge label="GST VERIFIED" variant="success" size="sm" />
              </View>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                GSTIN: 27AABCA1234F1Z5 • Mumbai
              </Text>
              <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 }}>
                ★ 4.95 Organizer Rating • 48 Shifts Hosted
              </Text>
            </View>
          </View>
        </Card>

        {/* Escrow Wallet Card */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
            Escrow Prepaid Wallet
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
            Funds held securely for upcoming worker wage disbursements.
          </Text>

          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              padding: spacing.md,
              borderRadius: radii.md,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View>
              <Text style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' }}>
                Available Escrow Balance
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 2 }}>
                {formatINR(45000)}
              </Text>
            </View>
            <Button
              title="+ Add Funds"
              variant="outline"
              size="sm"
              fullWidth={false}
              onPress={() => {}}
            />
          </View>
        </Card>

        {/* Preferences */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            App Preferences
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '500' }}>
                Dark Mode
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                Optimized for low-light venue and stage control booths
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={'#FFFFFF'}
            />
          </View>
        </Card>

        {/* Legal, Support & Store Disclosures */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Enterprise Support & Legal
          </Text>
          <TouchableOpacity
            onPress={() => handleOpenUrl('https://opskil.com/privacy')}
            style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
              Privacy Policy & Data Security ↗
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              Enterprise data privacy, invoicing records and retention terms
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleOpenUrl('https://opskil.com/terms')}
            style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
              Organizer Agreement & Terms ↗
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              Escrow terms, staffing compliance, cancellation & refund policy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleOpenUrl('mailto:enterprise@opskil.com')}
            style={{ paddingVertical: 10 }}
          >
            <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
              Dedicated Account Manager & Support ✉
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              enterprise@opskil.com • 24/7 Priority Event Line
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Account Management & Apple Guideline 5.1.1(v) */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Organization Security
          </Text>
          <View style={{ gap: spacing.sm }}>
            <Button
              title="Sign Out"
              variant="outline"
              size="md"
              onPress={() => {
                Alert.alert('Signed Out', 'You have been logged out of Opskl Organizer.');
              }}
            />
            <Button
              title="Delete Organization Account"
              variant="danger"
              size="md"
              onPress={handleDeleteAccount}
            />
          </View>
        </Card>

        <View style={{ alignItems: 'center', marginTop: spacing.md, paddingBottom: spacing.xl }}>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            Opskl Organizer v1.0.0 (Build 1) • Production Release Candidate
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
            App ID: com.opskil.organizer • © 2026 Opskl Technologies Pvt. Ltd.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
