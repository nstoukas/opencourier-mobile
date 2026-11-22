import { StyleSheet } from 'react-native';
import { color, control, radius, space, typeScale } from '@app/styles/theme';

// Row 84: the same card look as the Permissions screen (row 17), from the design tokens.
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
  intro: {
    ...typeScale['body-sm'],
    color: color['muted-foreground'],
    marginBottom: space['4'],
  },
  // The answer in one line, above the cards.
  summary: {
    ...typeScale.h4,
    color: color.foreground,
    marginBottom: space['4'],
  },
  card: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.xl,
    padding: space['4'],
    marginBottom: space['3'],
  },
  // A card with something to fix stands out on the warning tint.
  cardProblem: {
    borderColor: color.warning,
    backgroundColor: color['warning-soft'],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: control.sm,
  },
  cardTitle: {
    ...typeScale.body,
    fontWeight: '600',
    color: color.foreground,
    marginLeft: space['2'],
    flex: 1,
  },
  okText: {
    ...typeScale['body-sm'],
    fontWeight: '600',
    color: color.success,
    marginLeft: space['2'],
  },
  problemText: {
    ...typeScale['body-sm'],
    color: color.foreground,
    marginTop: space['2'],
    marginBottom: space['3'],
  },
  again: {
    marginTop: space['3'],
  },
});
