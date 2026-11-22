import { StyleSheet } from 'react-native';
import { color, space, typeScale } from '@app/styles/theme';

// Row 84: the Account screen, from the design tokens.
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background,
    paddingHorizontal: space['4'],
  },
  safe: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space['4'],
  },
  title: {
    ...typeScale.h3,
    color: color.foreground,
    marginLeft: space['4'],
    flex: 1,
  },
  content: {
    paddingHorizontal: space['4'],
    paddingBottom: space['6'],
  },
  cell: {
    marginBottom: space['4'],
  },
});
