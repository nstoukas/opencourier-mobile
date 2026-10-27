import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { control, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  content: {
    // A rider taps this: at least 48 px tall (spec 0007).
    minHeight: control.xl,
    paddingHorizontal: 10,
    marginTop: 22,
  },
  text: {
    fontWeight: '500',
    fontSize: typeScale['body-sm'].fontSize,
    marginLeft: 8,
    color: Colors.gray11,
    flex: 1,
    marginTop: 8,
    marginBottom: 8,
  },
  separator: { height: 1, backgroundColor: Colors.gray22 },
});
