import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
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
  checkmark: {
    width: 32,
    height: 32,
  },
});
