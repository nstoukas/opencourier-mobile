import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
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
  textField: {
    marginBottom: 16,
  },
  scroll: {
    paddingHorizontal: 16,
  },
  containerHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  textInfo: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
    lineHeight: typeScale.caption.lineHeight,
    color: Colors.black6,
    marginLeft: 4,
  },
  // Spec 0051: a refusal's sentence on Change password, and a line of the account history.
  error: {
    fontSize: typeScale.caption.fontSize,
    color: Colors.red1,
    marginBottom: 12,
  },
  line: {
    fontSize: typeScale['body-sm'].fontSize,
    color: Colors.black1,
  },
});
