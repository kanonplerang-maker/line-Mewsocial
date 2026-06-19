import { GoogleGenAI } from "@google/genai";
import { SHOP_PHONE, SHOP_LINE_ID } from "./constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MODEL = "gemini-3.5-flash";
const TIMEOUT_MS = 7_000;

function buildSystemPrompt(faqContent: string): string {
  return `<role>
คุณคือพี่ที่ร้านพักดี ร้านอาหาร/คาเฟ่ที่ตอบแชทลูกค้าทาง LINE
</role>

<constraints>
- ตอบโดยใช้ข้อมูลใน <faq> เท่านั้น ห้ามเดาหรือแต่งข้อมูลที่ไม่มีในนั้น
- ห้ามแต่งราคา เวลาทำการ หรือที่ตั้งขึ้นเองเด็ดขาด ต้องอ้างอิงจาก <faq> เท่านั้น
- ถ้าคำถามของลูกค้าไม่มีคำตอบใน <faq> ให้ตอบด้วยข้อความนี้เท่านั้น (ห้ามแต่งเอง):
  "ขอโทษนะคะ/ครับ เรื่องนี้พี่ขอเช็คให้อีกทีค่ะ/ครับ 🙏 รบกวนโทร ${SHOP_PHONE} หรือแอดไลน์ ${SHOP_LINE_ID} เพื่อคุยกับทีมงานโดยตรงเลยนะคะ/ครับ"
- โทนการตอบ: เป็นกันเอง อบอุ่น เหมือนพี่ในร้านคุยกับลูกค้า ใช้ emoji พอดีๆ ไม่มากไม่น้อยเกินไป
- ความยาวคำตอบ: 1-3 ประโยค กระชับ อ่านง่าย
</constraints>

<output_format>
ตอบเป็นภาษาไทยเท่านั้น ห้ามใช้ markdown (ห้ามมี **, #, -, ตัวเลขลิสต์ ฯลฯ) เพราะข้อความจะไปแสดงใน LINE chat โดยตรง
</output_format>

<faq>
${faqContent}
</faq>`;
}

export async function askGemini(
  userMessage: string,
  faqContent: string
): Promise<{ text: string; finishReason: string }> {
  const systemInstruction = buildSystemPrompt(faqContent);

  const geminiCall = ai.models.generateContent({
    model: MODEL,
    contents: `<question>\n${userMessage}\n</question>`,
    config: {
      systemInstruction,
      temperature: 1.0,
      maxOutputTokens: 1024,
    },
  });

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Gemini timeout")), TIMEOUT_MS)
  );

  const response = await Promise.race([geminiCall, timeout]);

  const finishReason = response.candidates?.[0]?.finishReason ?? "UNKNOWN";
  const text = response.text ?? "";

  console.log("[gemini]", {
    finishReason,
    thoughtsTokenCount: response.usageMetadata?.thoughtsTokenCount,
    candidatesTokenCount: response.usageMetadata?.candidatesTokenCount,
  });

  return { text, finishReason };
}
