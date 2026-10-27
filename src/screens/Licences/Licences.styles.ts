import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { control, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray14,
    paddingHorizontal: 16,
  },
  safe: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    marginBottom: 22,
  },
  title: {
    fontSize: typeScale.h1.fontSize,
    fontWeight: '700',
    color: Colors.black1,
    marginLeft: 16,
  },
  cell: {
    // A rider taps this: at least 48 px tall (spec 0007).
    minHeight: control.xl,
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'center',
  },
  cellContent: {
    flex: 1,
  },
  textCellTitle: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '700',
  },
  textCellInfo: {
    fontSize: typeScale.caption.fontSize,
  },
});
