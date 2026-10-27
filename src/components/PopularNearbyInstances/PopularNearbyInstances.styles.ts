import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.blue5,
    borderRadius: radius.xl,
    padding: 16,
  },
  containerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textTitle: {
    fontWeight: '700',
    fontSize: typeScale.body.fontSize,
    color: Colors.black7,
    lineHeight: typeScale.body.lineHeight,
    marginLeft: 8,
  },
});
