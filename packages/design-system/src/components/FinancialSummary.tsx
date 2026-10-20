import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { Divider } from './Divider';

export interface FinancialLineItem {
  label: string;
  amountLabel: string;
  emphasis?: 'default' | 'muted' | 'strong';
}

export interface FinancialSummaryProps {
  title?: string;
  items: FinancialLineItem[];
  totalLabel?: string;
  totalAmountLabel?: string;
  footnote?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Editorial financial breakdown — typography + separators, not a card grid of KPIs.
 * Pass already-formatted amount strings (e.g. from formatINR); never invent totals.
 */
export const FinancialSummary: React.FC<FinancialSummaryProps> = ({
  title,
  items,
  totalLabel,
  totalAmountLabel,
  footnote,
  style,
  testID,
}) => {
  const { colors, spacing, typography } = useOpsklTheme();

  return (
    <View testID={testID} style={[{ width: '100%' }, style]}>
      {title ? (
        <Text
          style={{
            fontSize: typography.label.fontSize,
            fontWeight: '700',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: colors.textSecondary,
            marginBottom: spacing.md,
          }}
        >
          {title}
        </Text>
      ) : null}

      {items.map((item, index) => (
        <View
          key={`${item.label}-${index}`}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            paddingVertical: spacing.sm,
            borderBottomWidth: index === items.length - 1 && !totalAmountLabel ? 0 : 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: typography.body.fontSize,
              color:
                item.emphasis === 'muted'
                  ? colors.textSecondary
                  : colors.textPrimary,
              fontWeight: item.emphasis === 'strong' ? '600' : '400',
              paddingRight: spacing.md,
            }}
          >
            {item.label}
          </Text>
          <Text
            style={{
              fontSize: typography.bodyBold.fontSize,
              fontWeight: item.emphasis === 'strong' ? '700' : '600',
              color: colors.textPrimary,
              fontVariant: ['tabular-nums'],
            }}
          >
            {item.amountLabel}
          </Text>
        </View>
      ))}

      {totalLabel && totalAmountLabel ? (
        <>
          <Divider />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              paddingTop: spacing.sm,
            }}
          >
            <Text style={[typography.subtitle, { color: colors.textPrimary }]}>{totalLabel}</Text>
            <Text style={[typography.wageCallout, { color: colors.textPrimary, fontSize: 22, lineHeight: 28 }]}>
              {totalAmountLabel}
            </Text>
          </View>
        </>
      ) : null}

      {footnote ? (
        <Text
          style={{
            marginTop: spacing.sm,
            fontSize: typography.caption.fontSize,
            color: colors.textMuted,
          }}
        >
          {footnote}
        </Text>
      ) : null}
    </View>
  );
};
