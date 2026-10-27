import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
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
  content: {
    flex: 1,
    marginVertical: 22,
    paddingHorizontal: 12,
  },
  textContent: {
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
    color: Colors.black,
  },
  textTitle: {
    fontSize: typeScale.display.fontSize,
    fontWeight: '700',
    marginBottom: 22,
  },
  textSubtitle: {
    fontSize: typeScale.h3.fontSize,
    marginBottom: 22,
  },
  buttonSignup: {
    marginTop: 80,
  },
  buttonLogin: {
    marginTop: 16,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: Colors.white,
  },
});
