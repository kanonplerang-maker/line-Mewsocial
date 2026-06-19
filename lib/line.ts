import { validateSignature, messagingApi } from "@line/bot-sdk";

export function verifySignature(body: string, signature: string): boolean {
  return validateSignature(body, process.env.LINE_CHANNEL_SECRET!, signature);
}

export function createLineClient(): messagingApi.MessagingApiClient {
  return new messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  });
}

export async function replyText(
  client: messagingApi.MessagingApiClient,
  replyToken: string,
  text: string
): Promise<void> {
  await client.replyMessage({
    replyToken,
    messages: [{ type: "text", text }],
  });
}
