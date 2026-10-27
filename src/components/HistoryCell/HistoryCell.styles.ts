import { Colors } from '@app/styles/colors';
import { StyleSheet } from 'react-native';
import { control, radius, typeScale } from '@app/styles/theme';

export const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: Colors.gray1,
    borderRadius: radius.xl,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: Colors.white,
  },
  containerSpaceBetween: {
    // A rider taps this: at least 48 px tall (spec 0007).
    minHeight: control.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  separator: {
    height: 2,
    backgroundColor: Colors.gray1,
    marginVertical: 10,
  },
  containerUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  containerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  textId: {
    fontWeight: '700',
    fontSize: typeScale.body.fontSize,
    lineHeight: typeScale.body.lineHeight,
    color: Colors.black1,
    flex: 1,
  },
  textStatus: {
    fontWeight: '500',
    fontSize: typeScale['body-sm'].fontSize,
    lineHeight: typeScale['body-sm'].lineHeight,
    color: Colors.black2,
  },
  textDeliveredTo: {
    fontSize: typeScale.body.fontSize,
    color: Colors.black1,
    lineHeight: typeScale.body.lineHeight,
  },
  textUserName: {
    fontSize: typeScale.h3.fontSize,
    marginRight: 16,
    lineHeight: typeScale.h3.lineHeight,
    color: Colors.black1,
  },
  imageUser: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: Colors.gray6,
  },
  iconSmall: {
    width: 16,
    height: 16,
    marginRight: 10,
  },
  textInfo: {
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.lineHeight,
    fontWeight: '600',
    color: Colors.black1,
  },
  containerStatus: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: radius.sm,
    borderColor: Colors.gray1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: Colors.gray2,
    marginRight: 7,
  },
  containerTImes: {
    flexDirection: 'row',
  },
  containerTime: {
    backgroundColor: Colors.blue5,
    paddingHorizontal: 10,
    borderRadius: radius['2xl'],
  },
  textTime: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '500',
    color: Colors.blue6,
  },
  imageCarret: {
    width: 24,
    height: 24,
    marginLeft: 8,
  },
  containerCarret: { flexDirection: 'row', alignItems: 'center' },
});
