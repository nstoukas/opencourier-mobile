import {
  Complaint,
  ComplaintAbout,
  ComplaintCategory,
  PagedList,
} from '@app/types/types';
import { UClient } from './Client';

// What the rider sends to file a complaint (spec 0052, AC-2). Slice 1 is text only: the photo comes
// with slice 2, as a multipart upload.
export type FileComplaintInput = {
  deliveryId: string;
  // A rider can complain only about the restaurant or the customer, never another rider.
  about: Exclude<ComplaintAbout, 'RIDER'>;
  category: ComplaintCategory;
  text: string;
};

export interface ComplaintService {
  fileComplaint: (input: FileComplaintInput) => Promise<Complaint>;
  getComplaints: (page: number) => Promise<PagedList<Complaint>>;
  replyToComplaint: (id: string, text: string) => Promise<Complaint>;
}

export const COMPLAINT_PAGE_SIZE = 20;

// Spec 0052: the rider's complaints. Every response is wrapped by the backend as { error, result }.
// The words go only to these routes, never to a log.
const complaintService = (client: UClient): ComplaintService => {
  const fileComplaint = async (
    input: FileComplaintInput,
  ): Promise<Complaint> => {
    const { data } = await client.post('complaints', input);
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
