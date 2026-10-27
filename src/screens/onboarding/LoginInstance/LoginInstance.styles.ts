import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { control, radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
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
  textField: {
    marginBottom: 22,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.black1,
    marginTop: 16,
  },
  containerBottom: {
    // A rider taps this: at least 48 px tall (spec 0007).
    minHeight: control.xl,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  textButton: {
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
    color: Colors.gray23,
  },
  imageLogin: {
    height: 20,
    width: 20,
    marginLeft: 4,
  },
  resetCard: {
    borderRadius: radius['2xl'],
    borderColor: Colors.green6,
    borderWidth: 1,
    padding: 24,
    marginBottom: 16,
    backgroundColor: Colors.white,
  },
  containerHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  textReset: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '700',
    lineHeight: typeScale.body.lineHeight,
    color: Colors.black1,
    flex: 1,
  },
  textEmailSent: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '600',
    lineHeight: typeScale['body-sm'].lineHeight,
    color: Colors.black6,
    marginBottom: 16,
  },
  imageX: {
    width: 20,
    height: 20,
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
