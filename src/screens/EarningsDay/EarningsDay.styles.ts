import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';

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
    fontSize: 28,
    fontWeight: '700',
    color: Colors.black1,
    marginLeft: 16,
    flexShrink: 1,
  },
  summaryCard: {
    borderRadius: 20,
    backgroundColor: Colors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  summaryTotal: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.black1,
  },
  summaryCount: {
    fontSize: 16,
    color: Colors.black1,
    marginTop: 2,
  },
  summaryBreakdown: {
    fontSize: 13,
    color: Colors.gray13,
    marginTop: 4,
  },
  cell: {
    backgroundColor: Colors.white,
    borderRadius: 12,
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
    fontSize: 16,
    fontWeight: '700',
    color: Colors.black1,
  },
  cellAddress: {
    fontSize: 13,
    color: Colors.gray13,
    marginTop: 2,
  },
  cellTime: {
    fontSize: 13,
    color: Colors.gray13,
    marginTop: 2,
  },
  cellTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.black1,
  },
  cellTips: {
    fontSize: 12,
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
