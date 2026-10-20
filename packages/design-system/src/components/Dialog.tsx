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
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Dialog: React.FC<DialogProps> = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
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
                  maxWidth: 360,
                  backgroundColor: colors.surface,
                  borderRadius: radii.xl,
                  padding: spacing.xl,
                  borderWidth: 1,
                  borderColor: isDark ? colors.border : colors.border,
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
                  { color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.xl },
                ]}
              >
                {message}
              </Text>

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
