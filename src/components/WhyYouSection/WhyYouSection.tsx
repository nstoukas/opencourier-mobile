import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EarningsWhyYou } from '@app/types/earnings';
import { Colors } from '@app/styles/colors';
import { color, radius, typeScale } from '@app/styles/theme';

// Spec 0045 (row 14): why this job came to the rider, in plain words, from the reason the server recorded
// at the offer. Only the rider's own figures arrive here (the server's allow list); no place in line, no
// other rider. The words are translation keys with values (row 47).

type Translate = (key: string, options?: Record<string, unknown>) => string;

const number = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

// "8 min", "1 h 05 min", or "under a minute".
export const durationWords = (seconds: number, t: Translate): string => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return t('translations:why_under_a_minute');
  if (minutes < 60) return t('translations:why_minutes', { minutes });
  return t('translations:why_hours', {
    hours: Math.floor(minutes / 60),
    minutes: String(minutes % 60).padStart(2, '0'),
  });
};

const WEIGHT_KEYS: Record<string, string> = {
  roadTime: 'translations:why_weight_road_time',
  earnings: 'translations:why_weight_earnings',
  waiting: 'translations:why_weight_waiting',
  shift: 'translations:why_weight_shift',
};

// The lines for one reason, in order. `money` formats cents in the co-op's currency.
export const whyYouLines = (
  whyYou: EarningsWhyYou | null,
  t: Translate,
  money: (cents: number) => string,
): string[] => {
  if (!whyYou) return [t('translations:why_none')];
  const v = whyYou.values;
  // Review fix (row 81): an add on went to the rider on a job it added the
  // fewest minutes to, not by the matcher's figures, so it is worded by its own
  // (the server sends only what it added to this rider's job). Read by its
  // strategy, it said "You were the nearest rider" or "a reason this version
  // cannot show".
  if (whyYou.kind === 'ADD_ON') {
    const km = number(v.extraKm);
    const minutes = number(v.extraMinutes);
    return [
      km !== null && minutes !== null
        ? t('translations:why_add_on', { km, minutes })
        : t('translations:why_add_on_plain'),
    ];
  }
  switch (whyYou.strategy) {
    case 'FAIRNESS': {
      const lines: string[] = [];
      // Review fix: a factor the co-op weighed at 0 did not count, so it gets no line (the server sends
      // only the weights above 0).
      const counted = (key: string) => number(whyYou.weights[key]) !== null;
      const road = number(v.roadSeconds);
      if (counted('roadTime') && road !== null) {
        lines.push(
          t(
            whyYou.estimated
              ? 'translations:why_road_estimated'
              : 'translations:why_road',
            { time: durationWords(road, t) },
          ),
        );
      }
      if (!counted('earnings')) {
        // Earnings did not count for this offer.
      } else if (v.earningsEqual === true) {
        lines.push(t('translations:why_earnings_equal'));
      } else if (v.earningsAssumed === true) {
        lines.push(t('translations:why_earnings_assumed'));
      } else {
        const cents = number(v.centsPerHour);
        if (cents !== null) {
          lines.push(
            t('translations:why_earnings', { money: money(Math.round(cents)) }),
          );
        }
      }
      const waiting = number(v.waitingSeconds);
      if (counted('waiting') && waiting !== null) {
        lines.push(
          t('translations:why_waiting', { time: durationWords(waiting, t) }),
        );
      }
      // Spec 0049 (AC-3): said only when the shift factor counted and the rider was on a booked shift.
      if (counted('shift') && v.onShift === true) {
        lines.push(t('translations:why_on_shift'));
      }
      const weights = Object.entries(whyYou.weights)
        .filter(([key]) => WEIGHT_KEYS[key])
        .map(([key, weight]) => t(WEIGHT_KEYS[key], { weight }));
      if (weights.length > 0) {
        lines.push(
          t('translations:why_weights', { weights: weights.join(', ') }),
        );
      }
      return lines.length > 0 ? lines : [t('translations:why_unknown')];
    }
    case 'NEAREST_COURIER': {
      const metres = number(v.straightMetres);
      // Review fix: Nearest by road time (spec 0031) records the road time; say so rather than "nearest".
      const roadSeconds = number(v.roadSeconds);
      if (roadSeconds !== null) {
        return [
          t('translations:why_nearest_road', {
            time: durationWords(roadSeconds, t),
          }),
        ];
      }
      return [
        metres === null
          ? t('translations:why_nearest_plain')
          : t('translations:why_nearest', { km: (metres / 1000).toFixed(1) }),
      ];
    }
    case 'COURIER_SENIORITY':
      return [t('translations:why_seniority')];
    case 'ADMIN':
    case 'STATIC':
      return [t('translations:why_dispatch')];
    default:
      // Review fix: a reason this app version cannot word yet is not "no reason".
      return [t('translations:why_unknown')];
  }
};

type Props = {
  whyYou: EarningsWhyYou | null;
  money: (cents: number) => string;
  onHowItWorks: () => void;
};

export const WhyYouSection = ({ whyYou, money, onHowItWorks }: Props) => {
  const { t } = useTranslation();
  return (
    <View style={styles.card} testID="earnings-why-you">
      <Text style={styles.title} accessibilityRole="header">
        {t('translations:why_title')}
      </Text>
      {whyYouLines(whyYou, t, money).map(line => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
      <TouchableOpacity
        onPress={onHowItWorks}
        accessibilityRole="link"
        testID="earnings-why-you-how">
        <Text style={styles.link}>{t('translations:why_how_link')}</Text>
      </TouchableOpacity>
    </View>
  );
};

// The job detail's own card and link look (EarningsDelivery.styles.ts, Earnings.styles.ts).
const styles = StyleSheet.create({
  card: {
    borderRadius: radius['2xl'],
    backgroundColor: Colors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '700',
    color: color.foreground,
    marginBottom: 6,
  },
  line: {
    fontSize: typeScale['body-sm'].fontSize,
    color: Colors.black1,
    marginBottom: 4,
  },
  link: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '600',
    color: Colors.black1,
    textDecorationLine: 'underline',
    marginTop: 6,
  },
});
