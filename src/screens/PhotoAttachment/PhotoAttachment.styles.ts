import { Colors } from '@app/styles/colors';
import { SCREEN_WIDTH } from '@app/utilities/constants';
import { Platform, StyleSheet } from 'react-native';
import { radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
    paddingHorizontal: 16,
  },
  safe: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 10 : 0,
  },
  containerButtonOk: {
    width: 60,
    height: 60,
    backgroundColor: Colors.white,
    borderColor: Colors.gray1,
    borderWidth: 4,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerCheckmark: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.black,
    borderRadius: radius.full,
  },
  checkmark: {
    width: 14,
    height: 14,
    tintColor: Colors.white,
  },
  containerRetake: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageTaken: {
    borderRadius: radius.sm,
    flex: 1,
    width: SCREEN_WIDTH * 0.88,
    marginVertical: 10,
  },
  containerImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  placeholder: {
    width: 60,
    height: 60,
  },
  textAttach: {
    fontSize: typeScale.h3.fontSize,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 19,
    marginTop: 4,
  },
  camera: {
    width: SCREEN_WIDTH * 0.88,
    flex: 1,
    alignSelf: 'center',
    marginVertical: 10,
  },
  grantText: {
    textAlign: 'center',
    fontSize: typeScale.h3.fontSize,
    fontWeight: '700',
    color: Colors.white,
    marginTop: 200,
  },
  textSettings: {
    textAlign: 'center',
    fontSize: typeScale.h3.fontSize,
    fontWeight: '700',
    color: Colors.white,
  },
  buttonSettings: {
    width: 100,
    marginTop: 20,
    alignSelf: 'center',
  },
});
