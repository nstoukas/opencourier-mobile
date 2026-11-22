import {
  Complaint,
  ComplaintAbout,
  ComplaintCategory,
  PagedList,
} from '@app/types/types';
import { UClient } from './Client';

// A photo picked from the gallery (slice 2): a file on the phone, as React Native's FormData sends one.
export type ComplaintPhoto = {
  uri: string;
  // image/jpeg or image/png. The server reads the file's first bytes, not this.
  type: string;
  name: string;
};

// What the rider sends to file a complaint (spec 0052, AC-2), with an optional photo.
export type FileComplaintInput = {
  deliveryId: string;
  // A rider can complain only about the restaurant or the customer, never another rider.
  about: Exclude<ComplaintAbout, 'RIDER'>;
  category: ComplaintCategory;
  text: string;
  photo?: ComplaintPhoto | null;
};

// The server refuses a photo over 5 MB; the app checks first so the rider is not left waiting.
export const COMPLAINT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
// A photo takes longer than the client's usual 10 s on a weak signal.
const PHOTO_UPLOAD_TIMEOUT_MS = 60000;

export interface ComplaintService {
  fileComplaint: (input: FileComplaintInput) => Promise<Complaint>;
  getComplaints: (page: number) => Promise<PagedList<Complaint>>;
  replyToComplaint: (id: string, text: string) => Promise<Complaint>;
}

export const COMPLAINT_PAGE_SIZE = 20;

// Spec 0052: the rider's complaints. Every response is wrapped by the backend as { error, result }.
// The words go only to these routes, never to a log.
const complaintService = (client: UClient): ComplaintService => {
  // Without a photo the body is JSON, as in slice 1. With one it is multipart/form-data: the same
  // fields as text, plus the file under `photo`. React Native's FormData sends a file given as
  // { uri, type, name }, reading it from the phone's storage itself.
  const fileComplaint = async ({
    photo,
    ...fields
  }: FileComplaintInput): Promise<Complaint> => {
    if (!photo) {
      const { data } = await client.post('complaints', fields);
      return data.result;
    }
    const form = new FormData();
    form.append('deliveryId', fields.deliveryId);
    form.append('about', fields.about);
    form.append('category', fields.category);
    form.append('text', fields.text);
    form.append('photo', photo);
    const { data } = await client.post('complaints', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: PHOTO_UPLOAD_TIMEOUT_MS,
    });
    return data.result;
  };

  const getComplaints = async (page: number): Promise<PagedList<Complaint>> => {
    const { data } = await client.get('complaints', {
      params: { page, perPage: COMPLAINT_PAGE_SIZE },
    });
    return data.result;
  };

  const replyToComplaint = async (
    id: string,
    text: string,
  ): Promise<Complaint> => {
    const { data } = await client.post(`complaints/${id}/reply`, { text });
    return data.result;
  };

  return { fileComplaint, getComplaints, replyToComplaint };
};

export default complaintService;
