import { StyleSheet } from 'react-native';
import { control, radius, space, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  // At least 48 px tall, and taller when a long label (often Greek) takes two lines, so the
  // words are never cut. The side padding keeps them off the rounded edges.
  container: {
    minHeight: control.xl,
    paddingHorizontal: space['4'],
    paddingVertical: space['1'],
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    flexDirection: 'row',
  },
  // flexShrink lets the label wrap inside the button instead of running past its edge.
  textTitle: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: typeScale.body.fontSize,
    fontWeight: '800',
    lineHeight: typeScale.body.lineHeight,
  },
  // Disabled: the type's own colors at half strength (the design system's disabled look).
  disabled: {
    opacity: 0.5,
  },
  iconLeft: {
    marginRight: 10,
  },
  iconRight: {
    marginLeft: 10,
  },
});
