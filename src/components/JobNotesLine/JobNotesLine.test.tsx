import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { JobNote, LEAVE_AT_DOOR } from '@app/utilities/jobCard';
import { Note } from '@app/types/types';
import { AddressNoteActions, JobNotesLine } from './JobNotesLine';
import { capitals } from '@app/utilities/capitals';

// Spec 0021 (AC-14), Spec 0053 (AC-2, AC-5, AC-7, AC-8):
// JobNotesLine displays notes on one line and opens a sheet grouping by author.
// With addressNotes (spec 0053), riders can add notes, upvote colleague notes,
// flag notes for admin review, edit/delete their own notes, and learn how notes work.
describe('JobNotesLine (spec 0021, spec 0053)', () => {
  let alertSpy: jest.SpyInstance;

  const mockActions: AddressNoteActions = {
    onAdd: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onUpvote: jest.fn(),
    onFlag: jest.fn(),
    retentionDays: 182,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  describe('no notes state (spec 0021 vs spec 0053)', () => {
    it('renders null when notes is empty and addressNotes is omitted (no notes, no line)', () => {
      const { toJSON } = render(<JobNotesLine notes={[]} />);
      expect(toJSON()).toBeNull();
    });

    it('renders "Add a note about this place" line when notes is empty but addressNotes is provided (spec 0053)', () => {
      const { getByTestId, getByText } = render(
        <JobNotesLine notes={[]} addressNotes={mockActions} />,
      );

      expect(getByTestId('job-notes-line')).toBeTruthy();
      expect(getByText(i18n.t('translations:address_note_add'))).toBeTruthy();
    });
  });

  describe('single and multiple notes display (spec 0021)', () => {
    it('renders a single note without +N counter', () => {
      const notes: JobNote[] = [
        { author: 'customer', text: 'Please ring the doorbell twice' },
      ];

      const { getByTestId, getByText, queryByText } = render(
        <JobNotesLine notes={notes} />,
      );

      expect(getByTestId('job-notes-line')).toBeTruthy();
      expect(getByText('Please ring the doorbell twice')).toBeTruthy();
      expect(queryByText(/\+/)).toBeNull();
    });

    it('renders translated "Leave at door" and +N for multiple notes', () => {
      const notes: JobNote[] = [
        { author: 'door', text: LEAVE_AT_DOOR },
        { author: 'customer', text: 'Knock gently' },
        { author: 'restaurant', text: 'Pizza box is hot' },
      ];

      const { getByTestId, getByText } = render(<JobNotesLine notes={notes} />);

      expect(getByTestId('job-notes-line')).toBeTruthy();
      expect(getByText(i18n.t('translations:leave_at_door'))).toBeTruthy();
      expect(getByText('+2')).toBeTruthy();
    });
  });

  describe('sheet grouping and address note actions (spec 0053)', () => {
    const otherRiderNote: Note = {
      id: 'note-colleague-1',
      note: 'Gate code 1234, watch out for dog',
      upvotes: 4,
      upvotedByMe: false,
      flaggedByMe: false,
      mine: false,
    };

    const myNote: Note = {
      id: 'note-mine-2',
      note: 'Lift is broken, walk up stairs',
      upvotes: 1,
      upvotedByMe: false,
      flaggedByMe: false,
      mine: true,
    };

    const notesWithAddressNotes: JobNote[] = [
      { author: 'door', text: LEAVE_AT_DOOR },
      { author: 'customer', text: 'Ring twice' },
      { author: 'restaurant', text: 'Handle with care' },
      {
        author: 'riders',
        text: otherRiderNote.note,
        addressNote: otherRiderNote,
      },
      {
        author: 'riders',
        text: myNote.note,
        addressNote: myNote,
      },
    ];

    it('opens sheet grouping notes by Customer, Restaurant, and Co-op riders without showing author names', () => {
      const { getByTestId, getByText, queryByText } = render(
        <JobNotesLine
          notes={notesWithAddressNotes}
          addressNotes={mockActions}
        />,
      );

      fireEvent.press(getByTestId('job-notes-line'));

      expect(getByTestId('job-notes-sheet')).toBeTruthy();
      expect(
        getByText(capitals(i18n.t('translations:notes_from_customer'))),
      ).toBeTruthy();
      expect(
        getByText(capitals(i18n.t('translations:notes_from_restaurant'))),
      ).toBeTruthy();
      expect(
        getByText(capitals(i18n.t('translations:notes_from_riders'))),
      ).toBeTruthy();

      // Note contents are shown
      expect(getByText(otherRiderNote.note)).toBeTruthy();
      expect(getByText(myNote.note)).toBeTruthy();

      // Author names/IDs are NEVER shown (AC-3)
      expect(queryByText(/courier/i)).toBeNull();
      expect(queryByText(/author/i)).toBeNull();
    });

    it('displays upvote count and allows upvoting colleague notes (AC-5)', () => {
      const { getByTestId, getByText } = render(
        <JobNotesLine
          notes={notesWithAddressNotes}
          addressNotes={mockActions}
        />,
      );

      fireEvent.press(getByTestId('job-notes-line'));

      const upvoteButton = getByTestId(
        `address-note-upvote-${otherRiderNote.id}`,
      );
      expect(upvoteButton).toBeTruthy();
      expect(getByText('4')).toBeTruthy();

      fireEvent.press(upvoteButton);
      expect(mockActions.onUpvote).toHaveBeenCalledWith(otherRiderNote);
    });

    it('allows flagging a colleague note with confirmation alert (AC-7)', () => {
      const { getByTestId } = render(
        <JobNotesLine
          notes={notesWithAddressNotes}
          addressNotes={mockActions}
        />,
      );

      fireEvent.press(getByTestId('job-notes-line'));

      const flagButton = getByTestId(`address-note-flag-${otherRiderNote.id}`);
      expect(flagButton).toBeTruthy();

      fireEvent.press(flagButton);

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_flag_title'),
        i18n.t('translations:address_note_flag_body'),
        expect.any(Array),
      );

      // Confirm flag in alert
      const buttons = alertSpy.mock.calls[0][2];
      const confirmButton = buttons.find(
        (b: any) => b.text === i18n.t('translations:address_note_flag_confirm'),
      );
      expect(confirmButton).toBeTruthy();

      act(() => {
        confirmButton.onPress();
      });

      expect(mockActions.onFlag).toHaveBeenCalledWith(otherRiderNote);
    });

    it('displays "Flagged" mark and hides flag button when already flagged by me (AC-7)', () => {
      const flaggedNote: Note = {
        ...otherRiderNote,
        flaggedByMe: true,
      };
      const notes: JobNote[] = [
        {
          author: 'riders',
          text: flaggedNote.note,
          addressNote: flaggedNote,
        },
      ];

      const { getByTestId, getByText, queryByTestId } = render(
        <JobNotesLine notes={notes} addressNotes={mockActions} />,
      );

      fireEvent.press(getByTestId('job-notes-line'));

      expect(
        getByText(i18n.t('translations:address_note_flagged_mark')),
      ).toBeTruthy();
      expect(queryByTestId(`address-note-flag-${flaggedNote.id}`)).toBeNull();
    });

    it('shows edit and delete buttons for the rider’s own note, and no upvote or flag (AC-5, AC-7)', () => {
      const { getByTestId, queryByTestId, getByLabelText } = render(
        <JobNotesLine
          notes={notesWithAddressNotes}
          addressNotes={mockActions}
        />,
      );

      fireEvent.press(getByTestId('job-notes-line'));

      // Upvote and flag must NOT be rendered for own note
      expect(queryByTestId(`address-note-upvote-${myNote.id}`)).toBeNull();
      expect(queryByTestId(`address-note-flag-${myNote.id}`)).toBeNull();

      // Edit and delete buttons are present
      expect(
        getByLabelText(i18n.t('translations:address_note_edit')),
      ).toBeTruthy();
      expect(
        getByLabelText(i18n.t('translations:address_note_delete')),
      ).toBeTruthy();
    });

    it('allows editing rider’s own note (AC-4)', () => {
      const { getByTestId, getByLabelText } = render(
        <JobNotesLine
          notes={notesWithAddressNotes}
          addressNotes={mockActions}
        />,
      );

      fireEvent.press(getByTestId('job-notes-line'));

      const editButton = getByLabelText(
        i18n.t('translations:address_note_edit'),
      );
      fireEvent.press(editButton);

      expect(mockActions.onEdit).toHaveBeenCalledWith(myNote);
    });

    it('allows deleting rider’s own note (AC-2)', () => {
      const { getByTestId, getByLabelText } = render(
        <JobNotesLine
          notes={notesWithAddressNotes}
          addressNotes={mockActions}
        />,
      );

      fireEvent.press(getByTestId('job-notes-line'));

      const deleteButton = getByLabelText(
        i18n.t('translations:address_note_delete'),
      );
      fireEvent.press(deleteButton);

      expect(mockActions.onDelete).toHaveBeenCalledWith(myNote);
    });

    it('provides "Add a note about this place" link in riders section (AC-2)', () => {
      const { getByTestId } = render(
        <JobNotesLine
          notes={notesWithAddressNotes}
          addressNotes={mockActions}
        />,
      );

      fireEvent.press(getByTestId('job-notes-line'));

      const addLink = getByTestId('address-note-add');
      expect(addLink).toBeTruthy();

      fireEvent.press(addLink);
      expect(mockActions.onAdd).toHaveBeenCalledTimes(1);
    });

    it('provides "How notes work" link opening the rules inside the sheet (AC-8)', () => {
      const { getByTestId, getByText } = render(
        <JobNotesLine
          notes={notesWithAddressNotes}
          addressNotes={mockActions}
        />,
      );

      fireEvent.press(getByTestId('job-notes-line'));

      const howLink = getByTestId('address-note-how');
      expect(howLink).toBeTruthy();

      fireEvent.press(howLink);

      // Sheet title changes to "How notes work" and rules component is rendered
      expect(
        getByText(i18n.t('translations:address_note_rules_title')),
      ).toBeTruthy();
      expect(getByTestId('address-notes-rules')).toBeTruthy();
    });
  });

  describe('in-flight busy guard on upvote and flag (Row 82 review)', () => {
    const colleagueNote: Note = {
      id: 'note-busy-1',
      note: 'Gate code 5678',
      upvotes: 2,
      upvotedByMe: false,
      flaggedByMe: false,
      mine: false,
    };

    const notesWithColleague: JobNote[] = [
      {
        author: 'riders',
        text: colleagueNote.note,
        addressNote: colleagueNote,
      },
    ];

    it('disables upvote and flag buttons when isBusy returns true for the note', () => {
      const busyActions: AddressNoteActions = {
        ...mockActions,
        isBusy: note => note.id === colleagueNote.id,
      };

      const { getByTestId } = render(
        <JobNotesLine notes={notesWithColleague} addressNotes={busyActions} />,
      );

      fireEvent.press(getByTestId('job-notes-line'));

      const upvoteButton = getByTestId(
        `address-note-upvote-${colleagueNote.id}`,
      );
      const flagButton = getByTestId(`address-note-flag-${colleagueNote.id}`);

      expect(upvoteButton.props.accessibilityState.disabled).toBe(true);
      expect(flagButton.props.accessibilityState.disabled).toBe(true);

      // Pressing disabled upvote should not call onUpvote
      fireEvent.press(upvoteButton);
      expect(busyActions.onUpvote).not.toHaveBeenCalled();

      // Pressing disabled flag should not open flag alert or call onFlag
      fireEvent.press(flagButton);
      expect(alertSpy).not.toHaveBeenCalled();
      expect(busyActions.onFlag).not.toHaveBeenCalled();
    });

    it('enables upvote and flag buttons when isBusy returns false', () => {
      const idleActions: AddressNoteActions = {
        ...mockActions,
        isBusy: () => false,
      };

      const { getByTestId } = render(
        <JobNotesLine notes={notesWithColleague} addressNotes={idleActions} />,
      );

      fireEvent.press(getByTestId('job-notes-line'));

      const upvoteButton = getByTestId(
        `address-note-upvote-${colleagueNote.id}`,
      );
      const flagButton = getByTestId(`address-note-flag-${colleagueNote.id}`);

      expect(upvoteButton.props.accessibilityState.disabled).toBe(false);
      expect(flagButton.props.accessibilityState.disabled).toBe(false);

      fireEvent.press(upvoteButton);
      expect(idleActions.onUpvote).toHaveBeenCalledWith(colleagueNote);
    });
  });
});
