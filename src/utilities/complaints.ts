import { ComplaintAbout, ComplaintCategory } from '@app/types/types';

// Spec 0052 (AC-1): the fixed list of categories for each `about`, in the order the form shows them. A
// copy of the backend's COMPLAINT_CATEGORIES (`src/domains/complaint/complaint-rules.ts`), which must stay
// the same: the server refuses a category that does not fit (400).
export const COMPLAINT_CATEGORIES: Record<
  ComplaintAbout,
  readonly ComplaintCategory[]
> = {
  RESTAURANT: [
    'LONG_WAIT',
    'FOOD_NOT_READY',
    'UNSAFE_PACKAGING',
    'RUDE_STAFF',
    'OTHER',
  ],
  CUSTOMER: ['ABUSE_OR_THREAT', 'UNSAFE_ADDRESS', 'NOT_ANSWERING', 'OTHER'],
  RIDER: ['LATE', 'RUDE', 'FOOD_DAMAGED', 'OTHER'],
};

// The backend keeps a complaint, a reply and an outcome to 1000 characters each.
export const COMPLAINT_TEXT_MAX_LENGTH = 1000;

// The translation key of a category's words. A code the app does not know (a newer server) reads
// "Other" rather than showing the raw code.
export const complaintCategoryKey = (category: string): string =>
  `translations:complaint_category_${category}`;
