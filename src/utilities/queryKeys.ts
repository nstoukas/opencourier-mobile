export const QueryKeys = {
  user: 'user',
  userSettings: 'userSettings',
  newOrders: 'newOrders',
  inProgressOrders: 'inProgressOrders',
  orderHistory: 'orderHistory',
  instance: 'instance',
  userInstances: 'userInstances',
  earningsSummary: 'earningsSummary',
  // Whether dispatch is stopped for heat or a storm (spec 0014); never saved to disk.
  dispatchState: 'dispatchState',
  earningsDay: 'earningsDay',
  earningsDelivery: 'earningsDelivery',
  // The co-op's dispatch number for the job screen (row 72); saved to disk with the deliveries.
  jobContact: 'jobContact',
  // The rider's jobs cancelled after they accepted them (spec 0015); saved to disk too.
  cancelledJobs: 'cancelledJobs',
};
