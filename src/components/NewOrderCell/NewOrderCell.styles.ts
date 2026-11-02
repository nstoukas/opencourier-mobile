import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { radius, space, typeScale } from '@app/styles/theme';
import { BUTTON_WIDTH } from '../ButtonSwipe/ButtonSwipe';

export const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: Colors.gray1,
    marginHorizontal: 16,
    borderRadius: radius.xl,
    padding: 12,
    marginVertical: 8,
  },
  textPrice: {
    fontSize: typeScale.amount.fontSize,
    fontWeight: '700',
    color: Colors.black3,
    textAlign: 'center',
  },
  textWaiting: {
    fontSize: typeScale.body.fontSize,
    color: Colors.black7,
    textAlign: 'center',
    marginTop: 4,
  },
  separator: {
    height: 2,
    backgroundColor: Colors.gray1,
    marginVertical: 12,
  },
  buttonTop: {
    marginBottom: 12,
  },
  textName: {
    fontWeight: '700',
    fontSize: typeScale.body.fontSize,
  },
  map: {
    width: 143,
    height: 138,
    borderRadius: radius.xl,
    backgroundColor: Colors.gray1,
    marginRight: 16,
  },
  containerLoader: {
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'absolute',
    left: 0,
    bottom: 0,
    right: 0,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  progress: {
    backgroundColor: Colors.gray6,
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
  },
  // Spec 0019: the ride's two lines under the total.
  textTrip: {
    fontSize: typeScale.body.fontSize,
    color: Colors.black3,
    textAlign: 'center',
    marginTop: space['1'],
  },
  // A restaurant or drop off line: icon, then the name or area.
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
    marginBottom: space['2'],
  },
  textArea: {
    fontSize: typeScale.body.fontSize,
    color: Colors.black3,
  },
  // Decline matches the Accept swipe's width (spec 0019, AC-5).
  buttonDecline: {
    width: BUTTON_WIDTH,
    alignSelf: 'center',
  },
});
