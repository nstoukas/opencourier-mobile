import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { checkPhoneRings, RingCheckItem } from '@app/services/ringCheck';

// Row 84: the "Is my phone set up to ring?" answers, read again each time the
// screen using this comes into view and each time the rider comes back to the
// app (usually from the phone setting a Fix button opened), so a setting just
// changed shows at once. Held in this screen's memory only (value 5).
// `items` is null until the first read finishes.
export const useRingCheck = () => {
  const navigation = useNavigation();
  const [items, setItems] = useState<RingCheckItem[] | null>(null);
  // Only the newest read may set the answer: an older one finishing late must
  // not show settings the rider has changed since. `useRef` keeps a value
  // across renders without causing one.
  const latestRead = useRef(0);

  // `useCallback` keeps the same function between renders, so the effects
  // below do not re-subscribe on every render.
  const recheck = useCallback(() => {
    latestRead.current += 1;
    const thisRead = latestRead.current;
    checkPhoneRings()
      .then(result => {
        if (thisRead === latestRead.current) {
          setItems(result);
        }
      })
      .catch(error => console.log('Ring check failed', String(error)));
  }, []);

  useEffect(() => {
    recheck();
    // `addListener` returns the function that removes the listener again. The
    // `?.` calls here are for tests, whose stand in navigation may lack these
    // methods; the real navigation always has them.
    const offFocus = navigation.addListener?.('focus', recheck);
    const subscription = AppState.addEventListener('change', state => {
      // Only while this screen is the one in view: Settings is a drawer
      // screen, which stays mounted after the rider leaves it.
      if (state === 'active' && (navigation.isFocused?.() ?? true)) {
        recheck();
      }
    });
    return () => {
      offFocus?.();
      subscription.remove();
      // A read still running when the screen goes must not set its answer.
      latestRead.current += 1;
    };
  }, [navigation, recheck]);

  return { items, recheck };
};
