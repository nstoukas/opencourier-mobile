import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  containerText: {
    flex: 1,
    marginRight: 12,
  },
  textDay: {
    fontWeight: '700',
    fontSize: 16,
    color: Colors.black1,
  },
  // Date and delivery count, quieter than the weekday above it.
  textDetail: {
    fontSize: 13,
    color: Colors.gray13,
    marginTop: 2,
  },
  textEarned: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.black1,
  },
  iconArrow: {
    width: 24,
    height: 24,
    marginLeft: 8,
  },
});
