import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TouchableWithoutFeedback,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { X } from 'lucide-react-native';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  containerStyle,
}) => {
  const { colors, radii, spacing, typography } = useOpsklTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <TouchableWithoutFeedback onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss sheet">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            justifyContent: 'flex-end',
          }}
        >
          <TouchableWithoutFeedback>
            <View
              style={[
                {
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: radii.xl,
                  borderTopRightRadius: radii.xl,
                  paddingHorizontal: spacing.lg,
                  paddingBottom: spacing.xxl + 8,
                  paddingTop: spacing.md,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                  maxHeight: '85%',
                },
                containerStyle,
              ]}
              accessibilityRole="summary"
            >
              {/* Handle indicator */}
              <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
                <View
                  style={{
                    width: 40,
                    height: 5,
                    borderRadius: radii.full,
                    backgroundColor: colors.border,
                  }}
                />
              </View>

              {/* Title & Close button */}
              {title ? (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: spacing.md,
                    minHeight: 44,
                  }}
                >
                  <Text style={[typography.h3, { color: colors.textPrimary, flex: 1 }]}>
                    {title}
                  </Text>
                  <Pressable
                    onPress={onClose}
                    hitSlop={8}
                    style={({ pressed }) => [
                      {
                        width: 44,
                        height: 44,
                        borderRadius: radii.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
                        transform: [{ scale: pressed ? 0.94 : 1.0 }],
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Close bottom sheet"
                  >
                    <X size={18} color={colors.textSecondary} strokeWidth={2.2} />
                  </Pressable>
                </View>
              ) : null}

              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
