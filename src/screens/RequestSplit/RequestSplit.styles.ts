import { StyleSheet } from 'react-native';
import { Colors } from '@app/styles/colors';
import { color, radius, space, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
  },
  safe: {
    flex: 1,
    paddingBottom: space['4'],
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: typeScale.h1.fontSize,
    color: color.foreground,
  },
  content: {
    paddingVertical: space['4'],
    gap: space['3'],
  },
  intro: {
    ...typeScale.body,
    color: color['muted-foreground'],
  },
  label: {
    ...typeScale.label,
    color: color.foreground,
    marginBottom: space['1.5'],
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['2'],
  },
  pill: {
    minHeight: 48,
    minWidth: 64,
    paddingHorizontal: space['4'],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: color.foreground,
    borderColor: color.foreground,
  },
  pillText: {
    ...typeScale.label,
    color: color.foreground,
  },
  pillTextSelected: {
    color: color.background,
  },
});
