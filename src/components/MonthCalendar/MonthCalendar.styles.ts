import { StyleSheet } from 'react-native';
import { color, control, radius, space, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    borderRadius: radius['2xl'],
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.border,
    padding: space['3'],
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space['2'],
  },
  arrow: {
    width: control.xl,
    height: control.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: typeScale.h4.fontSize,
    fontWeight: '600',
    color: color.foreground,
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: typeScale.caption.fontSize,
    color: color['muted-foreground'],
    paddingVertical: space['1'],
  },
  cell: {
    flex: 1,
    height: control.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  cellSelected: {
    backgroundColor: color.secondary,
  },
  cellText: {
    fontSize: typeScale['body-sm'].fontSize,
    color: color.foreground,
  },
  cellTextDisabled: {
    color: color.input,
  },
  cellTextSelected: {
    fontWeight: '700',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: color['chart-3'],
    marginTop: 2,
  },
  dotHidden: {
    backgroundColor: 'transparent',
  },
});
