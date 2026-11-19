import { client } from './Client';
import commentService, { CommentService } from './commentService';
import orderService, { OrderService } from './orderService';
import userService, { UserService } from './userService';
import earningsService, { EarningsService } from './earningsService';
import routeService, { RouteService } from './routeService';
import sosService, { SosService } from './sosService';
import chatService, { ChatService } from './chat/chatService';
import reviewService, { ReviewService } from './reviewService';
import { clearReviewSeen } from './reviewSeen';
import { clearReviewNotice } from './reviewNotice';
import { clearChatSeen } from './chat/chatSeen';
import { clearChatNotice } from './chat/chatNotice';
import { clearChatOutgoing } from './chat/chatOutgoing';
import { setOwnPosition } from './ownPosition';
import { clearRemovalNotices } from './removalNotice/removalNotice';
import { setLatestFix } from './latestFix';
import { clearHeldArrivals } from './heldArrivals';
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

  const logout = () => {
    client.defaults.headers.common.Authorization = undefined;
    // The next rider on this phone never sees the last one's position (spec 0018).
    setOwnPosition(null);
    // Nor inherits a fix or a held arrival from them (spec 0021).
    setLatestFix(null);
    clearPickedUpTimes();
    // The next rider never sees the last one's removal answers (spec 0035).
    clearRemovalNotices();
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
    clearHeldArrivals().catch(error =>
      console.log('Could not clear held arrivals', error),
    );
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
    notificationDeviceService: dService,
    logout,
  };
};

export default Services;
