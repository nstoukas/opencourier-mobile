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
  card: {
    borderRadius: radius['2xl'],
    backgroundColor: Colors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  total: {
    fontSize: typeScale.h1.fontSize,
    fontWeight: '700',
    color: Colors.black1,
  },
  totalLabel: {
    fontSize: typeScale['body-sm'].fontSize,
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
    fontSize: typeScale['body-sm'].fontSize,
    color: Colors.gray13,
    marginRight: 16,
  },
  rowValue: {
    fontSize: typeScale['body-sm'].fontSize,
    color: Colors.black1,
    flexShrink: 1,
    textAlign: 'right',
  },
  rowValueStrong: {
    fontWeight: '700',
  },
  // The delivery id is long and only useful verbatim, so give it its own line.
  idValue: {
    fontSize: typeScale.caption.fontSize,
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
