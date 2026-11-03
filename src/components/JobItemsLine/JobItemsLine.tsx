import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@app/components/Icon/Icon';
import { ReceiptIcon } from 'phosphor-react-native/src/icons/Receipt';
import { CheckSquareIcon } from 'phosphor-react-native/src/icons/CheckSquare';
import { SquareIcon } from 'phosphor-react-native/src/icons/Square';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { JobSheet } from '@app/components/JobSheet/JobSheet';
import { OrderItem } from '@app/types/types';
import { itemsDrinksFirst, kindCounts } from '@app/utilities/itemKinds';
import { color, control, radius, space, typeScale } from '@app/styles/theme';

// Ticks per delivery, in memory only: they are never sent (value 5) and never
// block the "Picked up" swipe. Kept outside the component so moving between
// jobs with the pager keeps them; gone when the app closes (spec 0021, AC-7).
const ticksByDelivery = new Map<string, Set<number>>();

type Props = { deliveryId: string; items: OrderItem[] | null | undefined };

// "N items ›" (spec 0021, AC-7): one compact line on the card, opening a sheet
// with a tick box per item. No items, no line. Spec 0028: drinks and sides are
// counted on the line and listed first in the sheet with a label; ticks stay
// keyed by each item's index in the order sent.
export const JobItemsLine = ({ deliveryId, items }: Props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // A number that changes with each tick, so the sheet draws again.
  const [, setVersion] = useState(0);
  if (!items || items.length === 0) {
    return null;
  }
  const ticks = ticksByDelivery.get(deliveryId) ?? new Set<number>();
  const { drinks, sides } = kindCounts(items);
  const marked = [
    drinks > 0 ? t('translations:items_drinks', { count: drinks }) : null,
    sides > 0 ? t('translations:items_sides', { count: sides }) : null,
  ].filter((part): part is string => part !== null);
  const countText = t('translations:items_count', { count: items.length });
  const lineText =
    marked.length > 0 ? `${countText} · ${marked.join(', ')}` : countText;
  const toggle = (index: number) => {
    const next = new Set(ticks);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    ticksByDelivery.set(deliveryId, next);
    setVersion(v => v + 1);
  };
  return (
    <>
      <TouchableOpacity
        style={styles.line}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        testID="job-items-line">
        <Icon icon={ReceiptIcon} size={20} tone="muted-foreground" />
        <Text style={styles.text}>{lineText}</Text>
        <Icon icon={CaretRightIcon} size={16} tone="muted-foreground" />
      </TouchableOpacity>
      <JobSheet
        visible={open}
        title={t('translations:items_title')}
        onClose={() => setOpen(false)}
        testID="job-items-sheet">
        {itemsDrinksFirst(items).map(({ item, sentIndex: index }) => {
          const ticked = ticks.has(index);
          return (
            <TouchableOpacity
              key={index}
              style={styles.item}
              onPress={() => toggle(index)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ticked }}
              testID={`job-item-${index}`}>
              <Icon
                icon={ticked ? CheckSquareIcon : SquareIcon}
                weight={ticked ? 'fill' : 'regular'}
                tone={ticked ? 'success' : 'muted-foreground'}
              />
              <View style={styles.itemText}>
                <View style={styles.nameRow}>
                  <Text style={styles.itemName}>
                    {item.quantity > 1
                      ? `${item.quantity} × ${item.name}`
                      : item.name}
                  </Text>
                  {/* Only the two known marks; anything else shows no pill (row 103 tests). */}
                  {item.kind === 'DRINK' || item.kind === 'SIDE' ? (
                    <Text style={styles.kind} testID={`job-item-kind-${index}`}>
                      {t(
                        item.kind === 'DRINK'
                          ? 'translations:item_kind_drink'
                          : 'translations:item_kind_side',
                      )}
                    </Text>
                  ) : null}
                </View>
                {/* With several lines the size is the order's, not this line's (spec 0028). */}
                {item.size && items.length === 1 ? (
                  <Text style={styles.itemSize}>{item.size}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </JobSheet>
    </>
  );
};

// For tests only: forget every tick.
export const resetItemTicksForTests = () => ticksByDelivery.clear();

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
    minHeight: control.xl,
  },
  text: {
    ...typeScale['body-sm'],
    color: color.foreground,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3'],
    minHeight: control.xl,
  },
  itemText: { flexShrink: 1 },
  itemName: { ...typeScale.body, color: color.foreground },
  itemSize: { ...typeScale.caption, color: color['muted-foreground'] },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
    flexWrap: 'wrap',
  },
  // The mark is a small filled pill, the one highlight spec 0028 asks for.
  kind: {
    ...typeScale.caption,
    fontWeight: '700',
    color: color['primary-foreground'],
    backgroundColor: color.primary,
    borderRadius: radius.full,
    paddingHorizontal: space['2'],
    overflow: 'hidden',
  },
});
