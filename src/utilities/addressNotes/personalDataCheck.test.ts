import {
  findPersonalData,
  foldForNameCheck,
  looksLikePersonalData,
} from './personalDataCheck';

// Spec 0053 (AC-4, cross check 6, decision 82.1, 82.3):
// Personal data check for courier address notes. Notes must describe the place, never the person.
// Detects phone numbers (8+ digits), email addresses, and common given names in Greek and English.
describe('personalDataCheck (spec 0053, AC-4)', () => {
  describe('foldForNameCheck', () => {
    it('folds Greek letters to lowercase and strips accents', () => {
      expect(foldForNameCheck('Γιώργος')).toBe('γιωργοσ');
      expect(foldForNameCheck('ΓΙΩΡΓΟΣ')).toBe('γιωργοσ');
      expect(foldForNameCheck('Ελένη')).toBe('ελενη');
      expect(foldForNameCheck('Δημήτρης')).toBe('δημητρησ');
      expect(foldForNameCheck('Άγγελος')).toBe('αγγελοσ');
    });

    it('folds final sigma ς to σ', () => {
      expect(foldForNameCheck('Νίκος')).toBe('νικοσ');
      expect(foldForNameCheck('Κώστας')).toBe('κωστασ');
    });

    it('folds Latin letters to lowercase and strips accents', () => {
      expect(foldForNameCheck('Michael')).toBe('michael');
      expect(foldForNameCheck('ANDRÉ')).toBe('andre');
      expect(foldForNameCheck('Zoë')).toBe('zoe');
    });
  });

  describe('phone number detection', () => {
    it('detects phone numbers with 8 or more digits', () => {
      expect(findPersonalData('6912345678')).toContain('phone');
      expect(findPersonalData('Call 2101234567 for code')).toContain('phone');
      expect(findPersonalData('+30 691 234 5678')).toContain('phone');
      expect(findPersonalData('Phone: 210-123-4567')).toContain('phone');
      expect(findPersonalData('Mobile: 691.234.5678')).toContain('phone');
      expect(looksLikePersonalData('+306912345678')).toBe(true);
    });

    it('detects phone numbers with spaced dashes or double spaces (Row 82 review)', () => {
      expect(findPersonalData('694 - 123 - 4567')).toContain('phone');
      expect(findPersonalData('694  123  4567')).toContain('phone');
      expect(findPersonalData('694--123--4567')).toContain('phone');
      expect(findPersonalData('210   123   4567')).toContain('phone');
      expect(findPersonalData('+30 694 - 123 - 4567')).toContain('phone');
      expect(findPersonalData('Call 694 . 123 . 4567 outside')).toContain(
        'phone',
      );
      expect(looksLikePersonalData('694 - 123 - 4567')).toBe(true);
      expect(looksLikePersonalData('694  123  4567')).toBe(true);
    });

    it('does not flag short numbers like door codes, apartment numbers or floor numbers', () => {
      expect(findPersonalData('Door code 1234')).not.toContain('phone');
      expect(findPersonalData('Code #54321 on keypad')).not.toContain('phone');
      expect(findPersonalData('Apartment 4B, 3rd floor')).not.toContain(
        'phone',
      );
      expect(findPersonalData('Ring bell 12, 7 digits: 1234567')).not.toContain(
        'phone',
      );
      expect(findPersonalData('Code 1 - 2 - 3')).not.toContain('phone');
      expect(findPersonalData('Apt 12 - 34')).not.toContain('phone');
    });
  });

  describe('email address detection', () => {
    it('detects email addresses', () => {
      expect(findPersonalData('Send code to rider@example.com')).toContain(
        'email',
      );
      expect(findPersonalData('Contact john.doe@work.co.uk')).toContain(
        'email',
      );
      expect(findPersonalData('Email: test_user@volos.gr')).toContain('email');
      expect(looksLikePersonalData('info@company.com')).toBe(true);
    });

    it('does not flag ordinary text with @ not formatted as email', () => {
      expect(findPersonalData('Meet @ door 3')).not.toContain('email');
      expect(findPersonalData('Wait @ the lobby')).not.toContain('email');
    });
  });

  describe('given name detection', () => {
    it('detects Greek names in Greek script across cases and grammatical forms', () => {
      // Nominative, genitive, vocative
      expect(findPersonalData('Ζητήστε τον Γιώργο')).toContain('name');
      expect(findPersonalData('Σπίτι του Γιώργου')).toContain('name');
      expect(findPersonalData('Ο Νίκος έχει το κλειδί')).toContain('name');
      expect(findPersonalData('Κουδούνι Νίκου')).toContain('name');
      expect(findPersonalData('Μαρία, 2ος όροφος')).toContain('name');
      expect(findPersonalData('Δώστε το στον Κώστα')).toContain('name');
      expect(findPersonalData('Κατερίνα')).toContain('name');
      expect(findPersonalData('Δημήτρης')).toContain('name');
    });

    it('detects Greek names written in Latin script', () => {
      expect(findPersonalData('Ask for Giorgos at reception')).toContain(
        'name',
      );
      expect(findPersonalData('Key is with Maria')).toContain('name');
      expect(findPersonalData('Call Nikos when outside')).toContain('name');
      expect(findPersonalData('Kostas, 4th floor')).toContain('name');
      expect(findPersonalData('Yiannis has the parcel')).toContain('name');
      expect(findPersonalData('Dimitris')).toContain('name');
    });

    it('detects English names in Latin script', () => {
      expect(findPersonalData('Leave with John at desk')).toContain('name');
      expect(findPersonalData('Sarah requested no contact')).toContain('name');
      expect(findPersonalData('Michael, apartment 12')).toContain('name');
      expect(findPersonalData('Emily')).toContain('name');
      expect(findPersonalData('David is waiting outside')).toContain('name');
    });

    it('detects English names written in Greek script', () => {
      expect(findPersonalData('Ρωτήστε τον Τζον')).toContain('name');
      expect(findPersonalData('Κουδούνι Τζορτζ')).toContain('name');
      expect(findPersonalData('Ντέιβιντ')).toContain('name');
    });

    it('does not flag common Greek words that were intentionally excluded from the names list (decision 82.3)', () => {
      // Everyday words left out on purpose because of frequent collisions:
      // Χάρης, Μηνάς, Αθηνά, Κυριακή, Παρασκευή, Χαρά, Ελπίδα, Δόξα, Αγάπη, Ξανθή, Μαρίνα, Πολ
      expect(findPersonalData('Οδός Αθηνάς 15')).not.toContain('name');
      expect(findPersonalData('Κλειστό την Κυριακή')).not.toContain('name');
      expect(findPersonalData('Παράδοση την Παρασκευή')).not.toContain('name');
      expect(findPersonalData('Με πολλή χαρά')).not.toContain('name');
      expect(findPersonalData('Λεωφόρος Ελπίδας')).not.toContain('name');
      expect(findPersonalData('Μαρίνα Βόλου')).not.toContain('name');
      expect(findPersonalData('Είσοδος πολ/κία')).not.toContain('name');
    });

    it('does not flag common English words that were intentionally excluded from the names list (decision 82.3)', () => {
      // English words left out: Will, Bill, Mark, Grace, Hope, Joy, Rose, May, June, April, Faith, Jack, Art, Pat, Ray, Max, Bob, Rob, Don, Guy
      expect(findPersonalData('Check the mark on the wall')).not.toContain(
        'name',
      );
      expect(findPersonalData('Will leave at the door')).not.toContain('name');
      expect(findPersonalData('Rose garden entrance')).not.toContain('name');
      expect(findPersonalData('May use the side gate')).not.toContain('name');
      expect(findPersonalData('Ask the delivery guy')).not.toContain('name');
      expect(findPersonalData('Art gallery entrance')).not.toContain('name');
    });
  });

  describe('clean address notes without personal data', () => {
    it('returns empty array and false for legitimate building and delivery instructions', () => {
      const safeNotes = [
        'The entrance is round the back near the parking area',
        'Doorbell is broken, please knock loudly on door 4B',
        'Beware of dog in the front yard, keep gate shut',
        'Ring intercom 1234, take lift to 3rd floor',
        'Leave package behind the big plant next to door',
        'Κουδούνι χαλασμένο, χτυπήστε την εξώπορτα',
        'Είσοδος από τον πίσω πεζόδρομο',
        'Προσοχή στα σκαλοπάτια, γλιστράνε όταν βρέχει',
        'Άσπρη καγκελόπορτα στα δεξιά',
      ];

      for (const note of safeNotes) {
        expect(findPersonalData(note)).toEqual([]);
        expect(looksLikePersonalData(note)).toBe(false);
      }
    });
  });

  describe('combined violations', () => {
    it('identifies multiple kinds of personal data in the same text', () => {
      const text = 'Call Maria at 6912345678 or email maria@gmail.com';
      const kinds = findPersonalData(text);

      expect(kinds).toContain('phone');
      expect(kinds).toContain('email');
      expect(kinds).toContain('name');
      expect(looksLikePersonalData(text)).toBe(true);
    });
  });
});
