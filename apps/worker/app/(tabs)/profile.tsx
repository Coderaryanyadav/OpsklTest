import { View, Text, ScrollView, Switch, Linking, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOpsklTheme, Card, Badge, Button } from '@opskil/design-system';

export default function WorkerProfileScreen() {
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
      'Delete Account',
      'Are you sure you want to permanently delete your Opskl worker account? All profile information, verification badges, and shift history will be permanently queued for deletion in accordance with Apple and Google Play store data safety guidelines.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Request Confirmed',
              'Your account deletion request has been submitted. Any pending settlements will be cleared, and all associated personal data will be purged within 30 days.'
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={[typography.h2, { color: colors.textPrimary }]}>Worker Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {/* User Card */}
        <Card variant="elevated">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.md,
              }}
            >
              <Text style={{ fontSize: 24, color: '#FFFFFF', fontWeight: '700' }}>AY</Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[typography.h3, { color: colors.textPrimary, marginRight: 6 }]}>
                  Aryan Yadav
                </Text>
                <Badge label="VERIFIED" variant="success" size="sm" />
              </View>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                +91 98200 98200 • Mumbai
              </Text>
              <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 }}>
                ★ 4.92 Rating • 14 Shifts Completed
              </Text>
            </View>
          </View>
        </Card>

        {/* Verification & KYC Status */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Identity & Compliance
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ fontSize: 14, color: colors.textPrimary }}>Government ID (Aadhaar)</Text>
            <Badge label="VERIFIED" variant="success" size="sm" />
          </View>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ fontSize: 14, color: colors.textPrimary }}>Bank Account / UPI</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>aryan@okhdfcbank</Text>
          </View>
        </Card>

        {/* Skills */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Certified Skill Badges
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['Registration & Scanning', 'VIP Ushering', 'Crowd Guidance', 'English & Hindi', 'Backstage Crew'].map((skill) => (
              <View
                key={skill}
                style={{
                  backgroundColor: colors.surfaceMuted,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: radii.full,
                }}
              >
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>
                  ✓ {skill}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Preferences & Theme */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Preferences
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '500' }}>
                Dark Mode
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                Adjust app theme for low-light environments
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
            Support & Legal Disclosures
          </Text>
          <TouchableOpacity
            onPress={() => handleOpenUrl('https://opskil.com/privacy')}
            style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
              Privacy Policy ↗
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              Learn how Opskl protects worker identity and payment data
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleOpenUrl('https://opskil.com/terms')}
            style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
              Terms of Service & Code of Conduct ↗
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              Marketplace rules, attendance guidelines and cancellation terms
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleOpenUrl('mailto:support@opskil.com')}
            style={{ paddingVertical: 10 }}
          >
            <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
              Contact Opskl Support & Grievance Desk ✉
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              support@opskil.com • Response within 2 hours
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Account Management & Apple Guideline 5.1.1(v) */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Account Security
          </Text>
          <View style={{ gap: spacing.sm }}>
            <Button
              title="Sign Out"
              variant="outline"
              size="md"
              onPress={() => {
                Alert.alert('Signed Out', 'You have been logged out of Opskl Worker.');
              }}
            />
            <Button
              title="Delete Account & Personal Data"
              variant="danger"
              size="md"
              onPress={handleDeleteAccount}
            />
          </View>
        </Card>

        <View style={{ alignItems: 'center', marginTop: spacing.md, paddingBottom: spacing.xl }}>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            Opskl Worker v1.0.0 (Build 1) • Production Release Candidate
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
            App ID: com.opskil.worker • © 2026 Opskl Technologies Pvt. Ltd.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
