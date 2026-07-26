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
  card: {
    borderRadius: 20,
    backgroundColor: Colors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  total: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.black1,
  },
  totalLabel: {
    fontSize: 14,
    color: Colors.gray13,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  rowSeparator: {
    height: 1,
    backgroundColor: Colors.gray1,
  },
  rowLabel: {
    fontSize: 14,
    color: Colors.gray13,
    marginRight: 16,
  },
  rowValue: {
    fontSize: 14,
    color: Colors.black1,
    flexShrink: 1,
    textAlign: 'right',
  },
  rowValueStrong: {
    fontWeight: '700',
  },
  // The delivery id is long and only useful verbatim, so give it its own line.
  idValue: {
    fontSize: 12,
    color: Colors.black1,
    marginTop: 4,
  },
  idRow: {
    paddingVertical: 10,
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
    textAlign: 'center',
  },
});
