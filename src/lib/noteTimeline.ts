// Best-effort extraction of request/follow-up dates that are embedded as
// free text inside tracking notes (e.g. "Requested on 6.24.26. Followed up
// on 6.29.26. Followed up on 6.30.26."). The source sheets have no
// dedicated "photo request date" or "follow-up count" columns, so this is
// the only signal available for those fields — every date returned here is
// read directly out of the note text, never invented.

export interface NoteTimeline {
  requestDate: string | null;
  lastFollowUpDate: string | null;
  followUpAttempts: number;
}

interface DateMatch {
  index: number;
  iso: string;
}

function toIso(month: number, day: number, year: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const fullYear = year < 100 ? 2000 + year : year;
  const d = new Date(Date.UTC(fullYear, month - 1, day));
  if (d.getUTCMonth() !== month - 1) return null;
  return d.toISOString().slice(0, 10);
}

function extractDates(text: string, defaultYear: number): DateMatch[] {
  const matches: DateMatch[] = [];
  const re = /\b(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    const year = m[3] ? parseInt(m[3], 10) : defaultYear;
    const iso = toIso(month, day, year);
    if (iso) matches.push({ index: m.index, iso });
  }
  return matches;
}

export function extractNoteTimeline(note: string | null, cycleYear: number): NoteTimeline {
  if (!note) return { requestDate: null, lastFollowUpDate: null, followUpAttempts: 0 };

  const dates = extractDates(note, cycleYear);
  const followUpMatches = note.match(/follow(ed)?[\s-]?up/gi) ?? [];
  const hasRequestKeyword = /request/i.test(note);

  if (dates.length === 0) {
    return {
      requestDate: null,
      lastFollowUpDate: null,
      followUpAttempts: followUpMatches.length,
    };
  }

  if (dates.length === 1) {
    if (hasRequestKeyword && !followUpMatches.length) {
      return { requestDate: dates[0].iso, lastFollowUpDate: null, followUpAttempts: 0 };
    }
    return { requestDate: null, lastFollowUpDate: dates[0].iso, followUpAttempts: Math.max(1, followUpMatches.length) };
  }

  // Multiple dates in text order: first is the request, remaining are follow-ups.
  const sorted = [...dates].sort((a, b) => a.index - b.index);
  return {
    requestDate: sorted[0].iso,
    lastFollowUpDate: sorted[sorted.length - 1].iso,
    followUpAttempts: Math.max(sorted.length - 1, followUpMatches.length),
  };
}
