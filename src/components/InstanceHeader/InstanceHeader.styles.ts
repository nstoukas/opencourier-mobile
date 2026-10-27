import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  blueSeparator: {
    height: 2,
    backgroundColor: Colors.blue1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  containerHeader: {
    backgroundColor: Colors.blue5,
    marginBottom: 10,
  },
  textJoin: {
    fontSize: typeScale.h3.fontSize,
    marginLeft: 12,
    marginBottom: 6,
    lineHeight: typeScale.h3.lineHeight,
    color: Colors.blue1,
  },
  headerContent: {},
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    width: 32,
    height: 32,
    marginLeft: 8,
  },
  containerHeaderText: {
    marginLeft: 8,
  },
  textName: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '600',
    lineHeight: typeScale.body.lineHeight,
    color: Colors.black,
  },
  textCount: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
    lineHeight: typeScale.caption.lineHeight,
    color: Colors.blackAlpha05,
  },
});
