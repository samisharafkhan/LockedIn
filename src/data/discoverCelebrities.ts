import type { PublishedScheduleDoc } from "../lib/userDirectory";
import type { StoredBlock } from "../lib/storage";
import type { ActivityId } from "../types";

/** Synthetic directory / Discover rows — not real accounts (no Firestore user). */
export function isSyntheticCelebrityUid(uid: string): boolean {
  return uid.startsWith("__celeb_");
}

const NAMES = `
Taylor Swift
Bad Bunny
Beyoncé
Drake
The Weeknd
Ariana Grande
Ed Sheeran
Billie Eilish
Rihanna
Kendrick Lamar
Dua Lipa
Harry Styles
Olivia Rodrigo
SZA
Travis Scott
Post Malone
Lady Gaga
Justin Bieber
Shakira
Coldplay
Adele
Bruno Mars
Nicki Minaj
Eminem
Jay-Z
Rosalía
Karol G
Selena Gomez
Miley Cyrus
Lana Del Rey
Kanye West
Chris Brown
Doja Cat
Metro Boomin
Future
J Balvin
Maluma
Shawn Mendes
Camila Cabello
Sam Smith
Hozier
Imagine Dragons
Maroon 5
Metallica
Foo Fighters
BTS
BLACKPINK
Twice
Stray Kids
NewJeans
`
  .trim()
  .split(/\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const POOL: ActivityId[] = ["work", "gym", "focus", "class", "sleep", "chill", "social", "commute", "travel"];

const EMOJI = ["✨", "🎬", "🎤", "⚽", "🎧", "📚", "🎹", "🎮", "🎨", "🏃"];

function seedBlocks(seed: number): StoredBlock[] {
  const n = 4 + (seed % 4);
  const out: StoredBlock[] = [];
  let cur = 360 + (seed % 8) * 30;
  for (let k = 0; k < n; k += 1) {
    const dur = 45 + ((seed + k * 7) % 6) * 15;
    const sh = Math.floor(cur / 60) % 24;
    const sm = cur % 60;
    cur += dur;
    let eh = Math.floor(cur / 60);
    let em = cur % 60;
    if (eh >= 24) {
      eh = 24;
      em = 0;
    }
    out.push({
      id: `celeb-${seed}-${k}`,
      startHour: sh,
      startMinute: sm,
      endHour: eh,
      endMinute: em,
      activityId: POOL[(seed + k * 3) % POOL.length],
    });
  }
  return out;
}

export function buildDiscoverCelebrityRows(dayKey: string): PublishedScheduleDoc[] {
  return NAMES.map((displayName, i) => ({
    ownerUid: `__celeb_${i}`,
    dayKey,
    handle: `celeb_${i}`,
    displayName,
    avatarEmoji: EMOJI[i % EMOJI.length],
    bio: `Illustrative “public day” blocks for Discover — not affiliated with ${displayName}.`,
    blocks: seedBlocks(i),
  }));
}

export function getCelebrityPublished(ownerUid: string, dayKey: string): PublishedScheduleDoc | null {
  if (!isSyntheticCelebrityUid(ownerUid)) return null;
  const idx = Number(ownerUid.replace("__celeb_", ""));
  if (!Number.isFinite(idx) || idx < 0 || idx >= NAMES.length) return null;
  const displayName = NAMES[idx] ?? "Guest";
  return {
    ownerUid,
    dayKey,
    handle: `celeb_${idx}`,
    displayName,
    avatarEmoji: EMOJI[idx % EMOJI.length],
    bio: `Illustrative “public day” blocks for Discover — not affiliated with ${displayName}.`,
    blocks: seedBlocks(idx),
  };
}
