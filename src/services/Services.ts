import { client } from './Client';
import commentService, { CommentService } from './commentService';
import orderService, { OrderService } from './orderService';
import userService, { UserService } from './userService';
import earningsService, { EarningsService } from './earningsService';
import routeService, { RouteService } from './routeService';
import sosService, { SosService } from './sosService';
import chatService, { ChatService } from './chat/chatService';
import reviewService, { ReviewService } from './reviewService';
import timeWorkedService, { TimeWorkedService } from './timeWorkedService';
import complaintService, { ComplaintService } from './complaintService';
import { clearComplaintNotice } from './complaintNotice';
import { clearReviewSeen } from './reviewSeen';
import { clearReviewNotice } from './reviewNotice';
import { clearChatSeen } from './chat/chatSeen';
import { clearChatNotice } from './chat/chatNotice';
import { clearChatOutgoing } from './chat/chatOutgoing';
import { setOwnPosition } from './ownPosition';
import { clearRemovalNotices } from './removalNotice/removalNotice';
import { clearSplitNotices } from './splitNotice/splitNotice';
import { setLatestFix } from './latestFix';
import { clearHeldArrivals } from './heldArrivals';
import { clearStatementFiles } from './statements/statementsApi';
import { clearPickedPhotoFiles } from './complaintPhotoFiles';
import { clearPickedUpTimes } from './pickupTimes';
import notificationDeviceService, {
  NotificationDeviceService,
} from './notificationDeviceService';

export type Services = {
  userService: UserService;
  orderService: OrderService;
  commentService: CommentService;
  earningsService: EarningsService;
  routeService: RouteService;
  sosService: SosService;
  // The rider's chat with dispatch (spec 0034).
  chatService: ChatService;
  // Review requests and the explanation page (spec 0038).
  reviewService: ReviewService;
  // The rider's time worked and the co-op totals (spec 0040).
  timeWorkedService: TimeWorkedService;
  // Complaints the rider filed and the ones about them (spec 0052).
  complaintService: ComplaintService;
  notificationDeviceService: NotificationDeviceService;
  logout: () => void;
};

const Services = (): Services => {
  const uService = userService(client);
  const oService = orderService(client);
  const cService = commentService(client);
  const eService = earningsService(client);
  const dService = notificationDeviceService(client);
  const rService = routeService(client);
  const sService = sosService(client);
  const chService = chatService(client);
  const rvService = reviewService(client);
  const twService = timeWorkedService(client);
  const cpService = complaintService(client);

  const logout = () => {
    client.defaults.headers.common.Authorization = undefined;
    // The next rider on this phone never sees the last one's position (spec 0018).
    setOwnPosition(null);
    // Nor inherits a fix or a held arrival from them (spec 0021).
    setLatestFix(null);
    clearPickedUpTimes();
    // The next rider never sees the last one's removal answers (spec 0035).
    clearRemovalNotices();
    clearSplitNotices();
    // Nor what the last rider had seen of their chat (spec 0034, AC-12).
    clearChatSeen().catch(error =>
      console.log('Could not clear the chat seen mark', error),
    );
    clearChatNotice();
    // Nor the lines they wrote that were never sent.
    clearChatOutgoing();
    // Nor which review answers the last rider had opened, nor their notice (spec 0038).
    clearReviewSeen().catch(error =>
      console.log('Could not clear the review seen marks', error),
    );
    clearReviewNotice();
    // Nor the notice of a complaint waiting for the last rider's reply (spec 0052).
    clearComplaintNotice();
    clearHeldArrivals().catch(error =>
      console.log('Could not clear held arrivals', error),
    );
    // The statements this rider downloaded (spec 0050, row 76 review).
    clearStatementFiles().catch(() => undefined);
    // The picker's copies of complaint photos (row 83 review).
    clearPickedPhotoFiles().catch(() => undefined);
  };

  return {
    userService: uService,
    orderService: oService,
    commentService: cService,
    earningsService: eService,
    routeService: rService,
    sosService: sService,
    chatService: chService,
    reviewService: rvService,
    timeWorkedService: twService,
    complaintService: cpService,
    notificationDeviceService: dService,
    logout,
  };
};

export default Services;
