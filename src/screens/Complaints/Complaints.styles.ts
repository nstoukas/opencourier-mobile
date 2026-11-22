import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { color, radius, typeScale } from '@app/styles/theme';

// Spec 0052: the Complaints screen. Cards and lines as on "How offers and pay work" (HowItWorks).
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
  keyboardArea: {
    flex: 1,
  },
  card: {
    borderRadius: radius['2xl'],
    backgroundColor: Colors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 4,
  },
  // The first line of a card: who wrote it about whom.
  cardKicker: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '600',
    color: color['muted-foreground'],
  },
  cardTitle: {
    fontSize: typeScale.h3.fontSize,
    fontWeight: '700',
    color: Colors.black1,
  },
  line: {
    fontSize: typeScale.body.fontSize,
    color: color.foreground,
    lineHeight: 22,
    marginTop: 4,
  },
  muted: {
    fontSize: typeScale['body-sm'].fontSize,
    color: color['muted-foreground'],
  },
  // A complaint about the rider that waits for their reply.
  needsReply: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '700',
    color: color.destructive,
    marginTop: 8,
  },
  // The rider's reply, the outcome or the withdrawal, set off under the complaint.
  block: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.gray1,
    paddingLeft: 10,
    marginTop: 10,
    gap: 2,
  },
  blockTitle: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '700',
    color: color.foreground,
  },
  replyInput: {
    backgroundColor: Colors.gray1,
    minHeight: 80,
    borderRadius: radius.xl,
    padding: 10,
    marginTop: 8,
    fontSize: typeScale.body.fontSize,
    textAlignVertical: 'top',
  },
  replyCount: {
    fontSize: typeScale.caption.fontSize,
    color: Colors.gray12,
    textAlign: 'right',
    marginVertical: 6,
  },
  empty: {
    paddingVertical: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: typeScale.h3.fontSize,
    fontWeight: '700',
    color: Colors.black1,
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
