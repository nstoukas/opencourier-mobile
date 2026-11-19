export const QueryKeys = {
  user: 'user',
  userSettings: 'userSettings',
  newOrders: 'newOrders',
  inProgressOrders: 'inProgressOrders',
  orderHistory: 'orderHistory',
  earningsSummary: 'earningsSummary',
  // Whether dispatch is stopped for heat or a storm (spec 0014); never saved to disk.
  dispatchState: 'dispatchState',
  earningsDay: 'earningsDay',
  earningsDelivery: 'earningsDelivery',
  // The co-op's dispatch number for the job screen (row 72); saved to disk with the deliveries.
  jobContact: 'jobContact',
  // The rider's jobs cancelled after they accepted them (spec 0015); saved to disk too.
  cancelledJobs: 'cancelledJobs',
  // The road route of the offer or job on home (spec 0018). Never saved to disk:
  // it says where the rider is.
  deliveryRoute: 'deliveryRoute',
  // The restaurants' pickup points for the map's restaurant layer (spec 0018).
  pickupPoints: 'pickupPoints',
  // The shift schedule and this rider's bookings (spec 0027); saved to disk, so the banner survives a
  // restart with no signal.
  shifts: 'shifts',
  // The reasons a rider can give for coming off an order (spec 0035); never saved to disk.
  removalReasons: 'removalReasons',
  // The rider's chat with dispatch and the co-op's presets (spec 0034); never saved to disk.
  chatMessages: 'chatMessages',
  chatQuickReplies: 'chatQuickReplies',
  // Spec 0038: the explanation page, the rider's review requests and what changed. Never saved to
  // disk: the page must show the settings in effect when it opens.
  howItWorks: 'howItWorks',
  reviewRequests: 'reviewRequests',
  settingChanges: 'settingChanges',
  // Spec 0040: the home counter's snapshot, the rider's time worked and the co-op totals. Never saved to
  // disk (AC-10): a snapshot from yesterday would show a shift that has ended.
  timeWorkedCurrent: 'timeWorkedCurrent',
  timeWorked: 'timeWorked',
  coopTotals: 'coopTotals',
};
