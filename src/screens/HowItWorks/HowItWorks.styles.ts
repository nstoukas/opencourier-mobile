import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { color, radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray14,
    paddingHorizontal: 16,
  },
  safe: {
    flex: 1,
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
    marginBottom: 22,
  },
  title: {
    fontSize: typeScale.h1.fontSize,
    fontWeight: '700',
    color: Colors.black1,
    marginLeft: 16,
    flexShrink: 1,
  },
  card: {
    borderRadius: radius['2xl'],
    backgroundColor: Colors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: typeScale.h3.fontSize,
    fontWeight: '700',
    color: Colors.black1,
    marginBottom: 8,
  },
  line: {
    fontSize: typeScale.body.fontSize,
    color: color.foreground,
    lineHeight: 22,
    marginBottom: 8,
  },
  muted: {
    fontSize: typeScale['body-sm'].fontSize,
    color: color['muted-foreground'],
  },
  item: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.gray1,
    gap: 4,
  },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '600',
    color: color.foreground,
    flex: 1,
  },
  overdue: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '600',
    color: color.destructive,
  },
  newDot: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '700',
    color: color['success-foreground'],
    backgroundColor: color.success,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  answer: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.gray1,
    paddingLeft: 10,
    marginTop: 4,
    gap: 2,
  },
  answerTitle: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '700',
    color: color.foreground,
  },
  buttonGap: {
    marginTop: 8,
  },
  more: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  moreText: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '600',
    color: color.foreground,
    textDecorationLine: 'underline',
  },
});
