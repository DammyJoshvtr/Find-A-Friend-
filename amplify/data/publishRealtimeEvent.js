export function request(ctx) {
  return {
    payload: {
      channelId: ctx.arguments.channelId,
      event: ctx.arguments.event,
      payload: ctx.arguments.payload,
    }
  };
}

export function response(ctx) {
  return ctx.result;
}
