import { StyleSheet } from 'react-native';
import { control, radius, type } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    height: control.xl,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    flexDirection: 'row',
  },
  textTitle: {
    fontSize: type.body.fontSize,
    fontWeight: '800',
    lineHeight: type.body.lineHeight,
  },
  // Disabled: the type's own colors at half strength (the design system's disabled look).
  disabled: {
    opacity: 0.5,
  },
  icon: {
    width: 20,
    height: 20,
  },
});
