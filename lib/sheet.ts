interface FaqCache {
  content: string;
  expiresAt: number;
}

let cache: FaqCache | null = null;

export async function getFaqContent(): Promise<string | null> {
  const now = Date.now();

  if (cache && now < cache.expiresAt) {
    return cache.content;
  }

  const url = process.env.SHEET_CSV_URL;
  if (!url) {
    console.error("[sheet] SHEET_CSV_URL is not set");
    return cache?.content ?? null;
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const csv = await res.text();
    const formatted = parseCsvToFaq(csv);

    cache = { content: formatted, expiresAt: now + 60_000 };
    return formatted;
  } catch (err) {
    console.error("[sheet] Failed to fetch FAQ:", err);
    // ใช้ cache เก่าถ้ามี ดีกว่าไม่มีเลย
    return cache?.content ?? null;
  }
}

function parseCsvToFaq(csv: string): string {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return "";

  return lines
    .slice(1) // skip header
    .map((line) => {
      const cols = parseCsvLine(line);
      const question = cols[0]?.trim() ?? "";
      const answer = cols[1]?.trim() ?? "";
      if (!question || !answer) return null;
      return `Q: ${question}\nA: ${answer}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cols.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cols.push(current);
  return cols;
}
