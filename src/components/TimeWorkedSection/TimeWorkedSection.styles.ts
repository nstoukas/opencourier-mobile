import { StyleSheet } from 'react-native';
import { color, radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  card: {
    borderRadius: radius['2xl'],
    backgroundColor: color.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '700',
    color: color.foreground,
    marginBottom: 8,
  },
  coopRow: {
    marginBottom: 6,
  },
  coopLabel: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '700',
    color: color['muted-foreground'],
  },
  line: {
    fontSize: typeScale['body-sm'].fontSize,
    color: color.foreground,
  },
  muted: {
    fontSize: typeScale.caption.fontSize,
    color: color['muted-foreground'],
    marginTop: 2,
  },
  shift: {
    marginTop: 10,
    borderRadius: radius.md,
    backgroundColor: color.muted,
  },
  shiftHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  shiftText: {
    flex: 1,
  },
  breakLine: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '700',
    color: color['muted-foreground'],
    marginTop: 2,
  },
  details: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  detailsTitle: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '700',
    color: color.foreground,
    marginTop: 8,
  },
});
