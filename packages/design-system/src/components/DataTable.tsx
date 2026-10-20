import React from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle, ScrollView } from 'react-native';
import { useOpsklTheme } from '../context/ThemeContext';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  width?: number;
  flex?: number;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T, index: number) => string;
  onRowPress?: (row: T) => void;
  emptyMessage?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Lightweight table for dense operational lists.
 * Prefer typography rows over nested cards. Horizontal scroll when needed.
 */
export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  onRowPress,
  emptyMessage = 'No rows to display.',
  style,
  testID,
}: DataTableProps<T>) {
  const { colors, spacing, typography, touchTarget } = useOpsklTheme();

  return (
    <View testID={testID} style={[{ width: '100%' }, style]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View
            style={{
              flexDirection: 'row',
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              paddingBottom: spacing.sm,
              minHeight: touchTarget.min,
              alignItems: 'flex-end',
            }}
          >
            {columns.map((col) => (
              <View
                key={col.key}
                style={{
                  width: col.width,
                  flex: col.width ? undefined : col.flex ?? 1,
                  paddingHorizontal: spacing.sm,
                  minWidth: col.width ?? 100,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.micro.fontSize,
                    fontWeight: '700',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: colors.textSecondary,
                  }}
                >
                  {col.header}
                </Text>
              </View>
            ))}
          </View>

          {rows.length === 0 ? (
            <View style={{ paddingVertical: spacing.xxl, paddingHorizontal: spacing.sm }}>
              <Text style={{ fontSize: typography.body.fontSize, color: colors.textMuted }}>{emptyMessage}</Text>
            </View>
          ) : (
            rows.map((row, index) => {
              const content = (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: touchTarget.comfortable,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderMuted,
                    paddingVertical: spacing.sm,
                  }}
                >
                  {columns.map((col) => {
                    const cell = col.render(row);
                    return (
                      <View
                        key={col.key}
                        style={{
                          width: col.width,
                          flex: col.width ? undefined : col.flex ?? 1,
                          paddingHorizontal: spacing.sm,
                          minWidth: col.width ?? 100,
                        }}
                      >
                        {typeof cell === 'string' || typeof cell === 'number' ? (
                          <Text
                            style={{ fontSize: typography.body.fontSize, color: colors.textPrimary }}
                            numberOfLines={2}
                          >
                            {cell}
                          </Text>
                        ) : (
                          cell
                        )}
                      </View>
                    );
                  })}
                </View>
              );

              if (!onRowPress) {
                return <View key={keyExtractor(row, index)}>{content}</View>;
              }

              return (
                <Pressable
                  key={keyExtractor(row, index)}
                  onPress={() => onRowPress(row)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
                  })}
                >
                  {content}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
