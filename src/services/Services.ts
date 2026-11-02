import { client } from './Client';
import commentService, { CommentService } from './commentService';
import orderService, { OrderService } from './orderService';
import userService, { UserService } from './userService';
import instanceService, { InstanceService } from './instanceService';
import earningsService, { EarningsService } from './earningsService';
import routeService, { RouteService } from './routeService';
import { setOwnPosition } from './ownPosition';
import { setLatestFix } from './latestFix';
import { clearHeldArrivals } from './heldArrivals';
import notificationDeviceService, {
  NotificationDeviceService,
} from './notificationDeviceService';

export type Services = {
  userService: UserService;
  orderService: OrderService;
  commentService: CommentService;
  instanceService: InstanceService;
  earningsService: EarningsService;
  routeService: RouteService;
  notificationDeviceService: NotificationDeviceService;
  logout: () => void;
};

const Services = (): Services => {
  const uService = userService(client);
  const oService = orderService(client);
  const cService = commentService(client);
  const iService = instanceService(client);
  const eService = earningsService(client);
  const dService = notificationDeviceService(client);
  const rService = routeService(client);

  const logout = () => {
    client.defaults.headers.common.Authorization = undefined;
    // The next rider on this phone never sees the last one's position (spec 0018).
    setOwnPosition(null);
    // Nor inherits a fix or a held arrival from them (spec 0021).
    setLatestFix(null);
    clearHeldArrivals().catch(error =>
      console.log('Could not clear held arrivals', error),
    );
  };

  return {
    userService: uService,
    orderService: oService,
    commentService: cService,
    instanceService: iService,
    earningsService: eService,
    routeService: rService,
    notificationDeviceService: dService,
    logout,
  };
};

export default Services;
