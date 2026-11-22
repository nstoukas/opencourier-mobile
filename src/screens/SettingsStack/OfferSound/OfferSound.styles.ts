import { StyleSheet } from 'react-native';
import { color, space, typeScale } from '@app/styles/theme';

// Row 84: the offer sound screen, from the design tokens.
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
    paddingHorizontal: space['2'],
    paddingBottom: space['6'],
  },
  explained: {
    ...typeScale['body-sm'],
    color: color['muted-foreground'],
    marginBottom: space['4'],
  },
  // Something the rider must change (the phone is silenced), so in the main text color.
  note: {
    ...typeScale['body-sm'],
    color: color.foreground,
    marginBottom: space['4'],
  },
  button: {
    marginBottom: space['3'],
  },
});
