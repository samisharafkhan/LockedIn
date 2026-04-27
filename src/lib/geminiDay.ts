import { ACTIVITIES } from "../data/activities";
import { isValidRange } from "./scheduleBlocks";
import type { ActivityId, TimeBlock } from "../types";

const ACTIVITY_IDS = ACTIVITIES.map((a) => a.id) as readonly ActivityId[];

function extractJsonObject(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const i = t.indexOf("{");
  const j = t.lastIndexOf("}");
  if (i >= 0 && j > i) return t.slice(i, j + 1);
  return t;
}

type RawBlock = {
  startHour?: number;
  startMinute?: number;
  endHour?: number;
  endMinute?: number;
  activityId?: string;
};

function isActivityId(s: string): s is ActivityId {
  return (ACTIVITY_IDS as readonly string[]).includes(s);
}

/**
 * Call Gemini to turn free-form day text into blocks for *today* (one calendar day, 0:00–24:00).
 * Uses VITE_GEMINI_API_KEY (Google AI Studio).
 */
export async function generateDayBlocksFromText(dayDescription: string): Promise<Omit<TimeBlock, "id">[]> {
  const key = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
  if (!key) {
    throw new Error("Missing VITE_GEMINI_API_KEY. Add it to .env.local and restart the dev server.");
  }

  const model =
    (import.meta.env.VITE_GEMINI_MODEL as string | undefined)?.trim() || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const allowed = ACTIVITY_IDS.join(", ");
  const prompt = `You are helping build a day schedule. The user described their day in natural language.
Infer reasonable start/end times in 24h local time for TODAY only (one calendar day, from 0:00 through 24:00). Use 24,0 for "midnight" end if the day goes to the very end of the day.

Output ONLY a JSON object with this exact shape, no other text:
{ "blocks": [ { "startHour": 0-24, "startMinute": 0-59, "endHour": 0-24, "endMinute": 0-59, "activityId": "..." } ] }

 activityId must be one of: ${allowed}.
 Map activities sensibly: gym/sport -> gym, work/job -> work, class/school -> class, focus/study -> focus, bus/drive -> commute, sleep/nap when clearly sleep -> sleep, travel/trip -> travel, party/hangout -> social, relax/tv -> chill.

If the description is empty or too vague, return { "blocks": [] }.
User's description:
---
${dayDescription.slice(0, 8000)}
---`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new Error("No content from the model. Try a clearer description.");
  }

  const raw = JSON.parse(extractJsonObject(text)) as { blocks?: RawBlock[] };
  const list = Array.isArray(raw?.blocks) ? raw.blocks : [];

  const out: Omit<TimeBlock, "id">[] = [];
  for (const b of list) {
    if (
      typeof b.startHour !== "number" ||
      typeof b.startMinute !== "number" ||
      typeof b.endHour !== "number" ||
      typeof b.endMinute !== "number" ||
      typeof b.activityId !== "string" ||
      !isActivityId(b.activityId)
    ) {
      continue;
    }
    if (!isValidRange(b.startHour, b.startMinute, b.endHour, b.endMinute)) continue;
    out.push({
      startHour: b.startHour,
      startMinute: b.startMinute,
      endHour: b.endHour,
      endMinute: b.endMinute,
      activityId: b.activityId,
    });
  }

  if (out.length === 0) {
    throw new Error("The model did not return any valid blocks. Try adding times or activities.");
  }

  return out;
}
