import React from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle } from 'react-native';
import { FileText, Upload, X } from 'lucide-react-native';
import { useOpsklTheme } from '../context/ThemeContext';
import { Button } from './Button';

export interface DocumentUploadProps {
  label?: string;
  /** Display name of a selected file — never invent a fake document. */
  fileName?: string | null;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Parent must open a real picker / capture flow. */
  onPick: () => void;
  onClear?: () => void;
  /** Optional preview / open action when a file exists. */
  onPreview?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Document upload / preview control.
 * Does not fabricate evidence blobs — `onPick` must be wired by the host screen.
 */
export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  label = 'Document',
  fileName,
  helperText = 'PDF or image, max size per platform policy',
  error,
  disabled,
  loading,
  onPick,
  onClear,
  onPreview,
  style,
  testID,
}) => {
  const { colors, spacing, radii, typography, touchTarget, iconSizes } = useOpsklTheme();
  const hasFile = !!fileName;

  return (
    <View style={[{ width: '100%', marginBottom: spacing.md }, style]} testID={testID}>
      <Text
        style={{
          fontSize: typography.caption.fontSize,
          fontWeight: '600',
          color: colors.textSecondary,
          marginBottom: spacing.xs,
        }}
      >
        {label}
      </Text>

      <Pressable
        disabled={disabled || loading}
        onPress={hasFile && onPreview ? onPreview : onPick}
        accessibilityRole="button"
        accessibilityLabel={hasFile ? `Document ${fileName}` : `Upload ${label}`}
        style={({ pressed }) => ({
          minHeight: touchTarget.comfortable,
          borderRadius: radii.md,
          borderWidth: 1,
          borderStyle: hasFile ? 'solid' : 'dashed',
          borderColor: error ? colors.danger : pressed ? colors.borderFocus : colors.border,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          opacity: disabled ? 0.55 : 1,
        })}
      >
        {hasFile ? (
          <FileText size={iconSizes.lg} color={colors.textPrimary} />
        ) : (
          <Upload size={iconSizes.lg} color={colors.textSecondary} />
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: typography.body.fontSize,
              fontWeight: '600',
              color: colors.textPrimary,
            }}
            numberOfLines={1}
          >
            {hasFile ? fileName : loading ? 'Uploading…' : 'Choose file'}
          </Text>
          {!hasFile && helperText ? (
            <Text style={{ fontSize: typography.caption.fontSize, color: colors.textMuted, marginTop: 2 }}>
              {helperText}
            </Text>
          ) : null}
        </View>
        {hasFile && onClear ? (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove document"
            style={{ minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={iconSizes.md} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </Pressable>

      {!hasFile ? (
        <View style={{ marginTop: spacing.sm }}>
          <Button
            title="Upload document"
            onPress={onPick}
            variant="secondary"
            size="sm"
            loading={loading}
            disabled={disabled}
            fullWidth
          />
        </View>
      ) : null}

      {error ? (
        <Text style={{ marginTop: spacing.xs, fontSize: typography.caption.fontSize, color: colors.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};
