import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { control, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    // A rider taps this: at least 48 px tall (spec 0007).
    minHeight: control.xl,
    backgroundColor: Colors.white,
  },
  content: {
    flexDirection: 'row',
    padding: 16,
  },
  contentLeft: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.gray1,
  },
  imageLeft: {
    width: 35,
    height: 40,
  },
  imageRight: {
    width: 20,
    height: 20,
  },
  title: {
    fontWeight: '700',
    fontSize: typeScale.h3.fontSize,
    marginLeft: 20,
    marginRight: 8,
  },
});
