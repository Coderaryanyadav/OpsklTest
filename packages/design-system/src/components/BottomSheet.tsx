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
    >
      <TouchableWithoutFeedback onPress={onClose}>
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
                  }}
                >
                  <Text style={[typography.h3, { color: colors.textPrimary }]}>{title}</Text>
                  <Pressable
                    onPress={onClose}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Text style={{ fontSize: 18, color: colors.textMuted }}>✕</Text>
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
