import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { control, radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  labelTitle: {
    color: Colors.black,
    fontSize: typeScale.body.fontSize,
    lineHeight: typeScale.body.lineHeight,
    fontWeight: '700',
  },
  containerTextField: {
    flex: 1,
    justifyContent: 'center',
  },
  textInput: {
    color: Colors.black,
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '600',
    minHeight: control.xl,
    paddingVertical: 0,
  },
  labelError: {
    alignSelf: 'stretch',
    color: Colors.red1,
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
    fontWeight: '600',
    marginLeft: 4,
  },
  inputContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    borderWidth: 2,
    borderRadius: radius.xl,
    paddingHorizontal: 12,
    // The input itself fills the 48 px, so the whole box is the touch area (spec 0007).
    minHeight: control.xl,
  },
  textShow: {
    fontSize: typeScale.caption.fontSize,
    color: Colors.black,
    textTransform: 'uppercase',
  },
  textLabel: {
    paddingTop: 6,
    fontSize: typeScale.caption.fontSize,
    color: Colors.black1,
  },
  checkmark: {
    width: 24,
    height: 24,
  },
});
