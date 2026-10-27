import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { control, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    // A rider taps this: at least 48 px tall (spec 0007).
    minHeight: control.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 32,
    height: 32,
  },
  text: {
    marginHorizontal: 15,
    fontSize: typeScale['body-sm'].fontSize,
    flex: 1,
    color: Colors.black,
  },
  iconArrow: {
    width: 24,
    height: 24,
  },
});
