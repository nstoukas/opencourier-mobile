import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

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
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
  },
  buttonAdd: {
    width: 40,
    height: 40,
    backgroundColor: Colors.gray8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.xl,
  },
});
