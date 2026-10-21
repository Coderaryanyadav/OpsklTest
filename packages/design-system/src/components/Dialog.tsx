import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableWithoutFeedback,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { Button } from './Button';

export interface DialogProps {
  visible: boolean;
  title: string;
  message: string;
  impactSummary?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Dialog: React.FC<DialogProps> = ({
  visible,
  title,
  message,
  impactSummary,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
  children,
  style,
}) => {
  const { colors, radii, spacing, typography, isDark } = useOpsklTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <TouchableWithoutFeedback onPress={onCancel} accessibilityRole="button" accessibilityLabel="Dismiss dialog">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xl,
          }}
        >
          <TouchableWithoutFeedback>
            <View
              style={[
                {
                  width: '100%',
                  maxWidth: 380,
                  backgroundColor: colors.surface,
                  borderRadius: radii.xl,
                  padding: spacing.xl,
                  borderWidth: 1,
                  borderColor: isDark ? colors.borderStrong : colors.border,
                },
                style,
              ]}
              accessibilityRole="alert"
              accessibilityLabel={title}
            >
              <Text style={[typography.title2, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                {title}
              </Text>
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary, lineHeight: 22, marginBottom: impactSummary || children ? spacing.md : spacing.xl },
                ]}
              >
                {message}
              </Text>

              {impactSummary ? (
                <View
                  style={{
                    backgroundColor: isDestructive ? colors.dangerLight : colors.surfaceMuted,
                    borderRadius: radii.sm,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: isDestructive ? colors.danger : colors.border,
                    marginBottom: spacing.lg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: isDestructive ? colors.danger : colors.textPrimary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                      marginBottom: 2,
                    }}
                  >
                    Operational Impact
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      lineHeight: 18,
                      color: isDestructive ? colors.danger : colors.textSecondary,
                    }}
                  >
                    {impactSummary}
                  </Text>
                </View>
              ) : null}

              {children ? (
                <View style={{ marginBottom: spacing.lg }}>
                  {children}
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title={cancelText}
                  variant="outline"
                  size="md"
                  fullWidth={false}
                  style={{ flex: 1 }}
                  onPress={onCancel}
                />
                <Button
                  title={confirmText}
                  variant={isDestructive ? 'danger' : 'primary'}
                  size="md"
                  fullWidth={false}
                  style={{ flex: 1 }}
                  onPress={onConfirm}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
