export function request(ctx) {
  // We subscribe by channelId
  return {};
}

export function response(ctx) {
  const filter = { channelId: { eq: ctx.arguments.channelId } };
  extensions.setSubscriptionFilter(util.transform.toSubscriptionFilter(filter));
  return null;
}
