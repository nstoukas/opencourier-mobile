import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

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
  summaryCard: {
    borderRadius: radius['2xl'],
    backgroundColor: Colors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  summaryTotal: {
    fontSize: typeScale.h1.fontSize,
    fontWeight: '700',
    color: Colors.black1,
  },
  summaryCount: {
    fontSize: typeScale.body.fontSize,
    color: Colors.black1,
    marginTop: 2,
  },
  summaryBreakdown: {
    fontSize: typeScale['body-sm'].fontSize,
    color: Colors.gray13,
    marginTop: 4,
  },
  cell: {
    backgroundColor: Colors.white,
    borderRadius: radius.xl,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cellText: {
    flex: 1,
    marginRight: 12,
  },
  cellStore: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '700',
    color: Colors.black1,
  },
  cellAddress: {
    fontSize: typeScale['body-sm'].fontSize,
    color: Colors.gray13,
    marginTop: 2,
  },
  cellTime: {
    fontSize: typeScale['body-sm'].fontSize,
    color: Colors.gray13,
    marginTop: 2,
  },
  cellTotal: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '700',
    color: Colors.black1,
  },
  cellTips: {
    fontSize: typeScale.caption.fontSize,
    color: Colors.gray13,
    marginTop: 2,
    textAlign: 'right',
  },
  cellAmount: {
    alignItems: 'flex-end',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyTitle: {
    fontWeight: '700',
    color: Colors.black1,
  },
  emptySubtitle: {
    color: Colors.black1,
    marginTop: 10,
  },
});
