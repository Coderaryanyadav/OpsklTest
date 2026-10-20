import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { OpsklIcon } from './Icon';

export interface StepItem {
  id: string | number;
  label?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStepIndex: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStepIndex,
  style,
  testID = 'stepper',
}) => {
  const { colors, spacing, radii, typography } = useOpsklTheme();

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing.md,
        },
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: Math.max(steps.length - 1, 0),
        now: currentStepIndex,
      }}
      accessibilityLabel={`Step ${currentStepIndex + 1} of ${steps.length}`}
      testID={testID}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            <View
              style={{ alignItems: 'center' }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radii.full,
                  backgroundColor: isCompleted
                    ? colors.success
                    : isCurrent
                    ? colors.primary
                    : colors.surfaceSecondary,
                  borderWidth: isCurrent ? 2 : 1,
                  borderColor: isCurrent
                    ? colors.primary
                    : isCompleted
                    ? colors.success
                    : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isCompleted ? (
                  <OpsklIcon name="check" size={14} color={colors.textInverse} />
                ) : (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: isCurrent ? colors.textInverse : colors.textSecondary,
                    }}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>

              {step.label ? (
                <Text
                  style={{
                    fontSize: typography.caption.fontSize,
                    fontWeight: isCurrent ? '700' : '500',
                    color: isCurrent ? colors.textPrimary : colors.textSecondary,
                    marginTop: spacing.xxs,
                    textAlign: 'center',
                  }}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
              ) : null}
            </View>

            {!isLast && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: isCompleted ? colors.success : colors.border,
                  marginHorizontal: spacing.xs,
                  marginBottom: step.label ? 16 : 0,
                }}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};
