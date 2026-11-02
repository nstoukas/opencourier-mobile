import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import { ArrivalStage } from './arrival';

// The one stop job card (spec 0021, AC-6 to AC-9, AC-14): what it shows,
// worked out here as plain functions with no React, so each rule can be
// tested on its own.

// The order code the rider shows the restaurant: the last 6 characters of
// the delivery id, the same rule as adminweb's `shortId` and request-web's
// status page, so all three read the same code (AC-7, AC-10).
export const orderCodeOf = (deliveryId: string): string => deliveryId.slice(-6);

// The customer's first name, the bag's label at the restaurant (AC-7): the
// first word of the name the restaurant typed. '' when there is none.
export const firstNameOf = (name: string | null | undefined): string =>
  name?.trim().split(/\s+/)[0] ?? '';

// Who wrote a note, as the notes sheet groups them (AC-14).
export type NoteAuthor = 'door' | 'customer' | 'restaurant' | 'riders';

export type JobNote = { author: NoteAuthor; text: string };

// The value of `deliverableAction` that asks the rider to leave the order.
// Meeting at the door is the normal case and is never shown.
export const LEAVE_AT_DOOR = 'LEAVE_AT_DOOR';

const clean = (text: string | null | undefined): string => text?.trim() ?? '';

// Every note for the stop the card shows, in the order the one line picks its
// first: leave at door, then the customer's own, then the restaurant's, then
// other riders' notes on that place (AC-14). Empty texts are left out.
export const notesFor = (order: Order, stage: ArrivalStage): JobNote[] => {
  const notes: JobNote[] = [];
  const add = (author: NoteAuthor, text: string | null | undefined) => {
    const value = clean(text);
    if (value) {
      notes.push({ author, text: value });
    }
  };
  if (stage === 'pickup') {
    add('restaurant', order.pickupNotes);
    (order.pickupLocationNotes ?? []).forEach(note => add('riders', note.note));
    return notes;
  }
  if (order.deliverableAction === LEAVE_AT_DOOR) {
    // The text is filled in by the screen (it is translated); an author of
    // 'door' with no text would be dropped, so it carries a marker.
    notes.push({ author: 'door', text: LEAVE_AT_DOOR });
  }
  add('customer', order.dropoffNotes);
  (order.customerNotes ?? []).forEach(text => add('customer', text));
  add('restaurant', order.dropoffSellerNotes);
  (order.dropOffLocationNotes ?? []).forEach(note => add('riders', note.note));
  return notes;
};

// The stop the card shows (AC-6): the restaurant until the pickup, the
// customer after. `status` is the status the screen shows.
export const cardStageOf = (status: string): ArrivalStage =>
  // Typed as plain strings so `includes(status)` accepts any status text.
  (
    [
      OrderStatus.accepted,
      OrderStatus.dispatched,
      OrderStatus.courier_arrived_at_pickup_location,
    ] as string[]
  ).includes(status)
    ? 'pickup'
    : 'dropoff';
