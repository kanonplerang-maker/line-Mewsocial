import { NextRequest, NextResponse } from "next/server";
import { verifySignature, createLineClient, replyText } from "@/lib/line";
import { getFaqContent } from "@/lib/sheet";
import { askGemini } from "@/lib/gemini";
import { DEFAULT_REPLY } from "@/lib/constants";

type LineEvent = {
  type: string;
  replyToken?: string;
  message?: {
    type: string;
    text?: string;
    id: string;
  };
};

export async function POST(req: NextRequest) {
  let body = "";

  try {
    body = await req.text();
    const signature = req.headers.get("x-line-signature") ?? "";

    if (!verifySignature(body, signature)) {
      console.warn("[webhook] Invalid signature");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const payload = JSON.parse(body) as { events: LineEvent[] };
    const client = createLineClient();

    for (const event of payload.events) {
      if (event.type !== "message" || event.message?.type !== "text") continue;

      const userMessage = event.message.text ?? "";
      const replyToken = event.replyToken ?? "";

      try {
        const faqContent = await getFaqContent();

        if (!faqContent) {
          console.warn("[webhook] No FAQ content, using default reply");
          await replyText(client, replyToken, DEFAULT_REPLY);
          continue;
        }

        const { text, finishReason } = await askGemini(userMessage, faqContent);

        if (finishReason === "MAX_TOKENS" || !text) {
          console.warn(`[webhook] finishReason=${finishReason}, using default reply`);
          await replyText(client, replyToken, DEFAULT_REPLY);
        } else {
          await replyText(client, replyToken, text);
        }
      } catch (eventErr) {
        console.error("[webhook] Error handling event:", eventErr);
        try {
          await replyText(client, replyToken, DEFAULT_REPLY);
        } catch (replyErr) {
          // replyToken หมดอายุแล้ว กู้คืนไม่ได้
          console.error("[webhook] Failed to send default reply:", replyErr);
        }
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    // return 200 เสมอ กัน LINE retry รัว
    console.error("[webhook] Unhandled error:", err);
    return new NextResponse("OK", { status: 200 });
  }
}
