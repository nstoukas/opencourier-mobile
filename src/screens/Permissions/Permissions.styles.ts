import { StyleSheet } from 'react-native';
import { color, control, radius, space, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: color.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: space['6'],
    paddingTop: space['8'],
    paddingBottom: space['6'],
  },
  title: {
    ...typeScale.h2,
    color: color.foreground,
    marginBottom: space['2'],
  },
  body: {
    ...typeScale.body,
    color: color['muted-foreground'],
    marginBottom: space['6'],
  },
  card: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.xl,
    padding: space['4'],
    marginBottom: space['4'],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space['2'],
  },
  cardTitle: {
    ...typeScale.h4,
    color: color.foreground,
    marginLeft: space['2'],
    flex: 1,
  },
  cardWhy: {
    ...typeScale['body-sm'],
    color: color['muted-foreground'],
    marginBottom: space['3'],
  },
  allowed: {
    flexDirection: 'row',
    alignItems: 'center',
    height: control.xl,
  },
  allowedText: {
    ...typeScale.body,
    fontWeight: '600',
    color: color.success,
    marginLeft: space['2'],
  },
  spacer: {
    flex: 1,
    minHeight: space['6'],
  },
});
