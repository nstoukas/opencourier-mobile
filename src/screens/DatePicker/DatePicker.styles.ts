import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.transparentModalBackground,
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.white,
    paddingTop: 20,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 32,
  },
  textDone: {
    fontSize: typeScale.h3.fontSize,
    fontWeight: '800',
  },
});
