import type { ReactNode } from 'react';
import { ScrollView, View, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { space } from '../theme/tokens';

export function Screen({ children, scroll, edges = ['top'], refreshControl, contentStyle }: { children: ReactNode; scroll?: boolean; edges?: Edge[]; refreshControl?: React.ReactElement<RefreshControlProps>; contentStyle?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[{ padding: space(2), gap: space(2), paddingBottom: space(6) }, contentStyle]} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
