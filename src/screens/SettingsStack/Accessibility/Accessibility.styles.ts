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
  list: {
    paddingHorizontal: 16,
  },
  headerText: {
    fontSize: typeScale.h2.fontSize,
    lineHeight: typeScale.h2.lineHeight,
    color: Colors.gray21,
  },
  containerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingBottom: 8,
  },
  headerLine: {
    height: 1,
    backgroundColor: Colors.gray1,
    flex: 1,
  },
});
