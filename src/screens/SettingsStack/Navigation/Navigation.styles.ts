import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: 32,
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
  containerHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  textSectionTitle: {
    fontWeight: '600',
    fontSize: typeScale['body-sm'].fontSize,
    lineHeight: typeScale['body-sm'].lineHeight,
    color: Colors.black,
  },
  textInfo: {
    fontWeight: '500',
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
    color: Colors.blackAlpha05,
  },
  containerGray: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.gray8,
    borderRadius: radius['2xl'],
    padding: 4,
    marginTop: 8,
  },
  button: {
    borderRadius: radius['2xl'],
    padding: 8,
  },
  textButton: {
    fontWeight: '600',
    fontSize: typeScale['body-sm'].fontSize,
    lineHeight: typeScale['body-sm'].lineHeight,
    color: Colors.black1,
  },
  containerText: {
    flex: 1,
  },
});
