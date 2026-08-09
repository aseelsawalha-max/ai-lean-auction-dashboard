import type { AIIssueCategory, ResponsibleParty } from "./types";

// Heuristic free-text classifier standing in for an LLM-based classification
// step. It never invents a responsible party it can't support in the text —
// ambiguous or unmatched notes fall through to "Unknown" per the spec's
// safeguard against automatically blaming BOG.
//
// Rule vocabulary below was tuned against the real July/August 2026 tracking
// sheets, where "BOG" and "owner" often mean something narrower than the
// original spec's framing (e.g. "owner working with tenant to pay" is the
// facility owner pausing the process to negotiate directly with the tenant,
// not a delay in supplying photos). Patterns are ordered specific-first.
//
// To upgrade to real AI: replace `classifyNote`'s body with a call to an LLM
// (e.g. Claude) given the note text, keeping the same return shape. The
// original note text passed in here must always be persisted unchanged
// alongside the result — this function only ever reads it.

export interface ClassificationResult {
  category: AIIssueCategory;
  responsibleParty: ResponsibleParty;
  rootCause: string;
  confidence: number;
  needsReview: boolean;
}

interface Rule {
  category: AIIssueCategory;
  responsibleParty: ResponsibleParty;
  rootCause: string;
  patterns: RegExp[];
  confidence: number;
}

const RULES: Rule[] = [
  {
    category: "No Delay",
    responsibleParty: "No Delay",
    rootCause: "Photos were received without incident",
    patterns: [
      /photos? (received|uploaded) on time/i,
      /no issues?\.?$/i,
      /straightforward request/i,
      /responded quickly/i,
      /\buploaded (photos?|to ai ?lean)/i,
      /photos? uploaded to ai ?lean/i,
      /(lease|com|nra)[\s,]*(and)?\s*photos? (are )?uploaded/i,
    ],
    confidence: 0.95,
  },
  {
    category: "No Delay",
    responsibleParty: "No Delay",
    rootCause: "Auction proceeded as scheduled",
    patterns: [/sold for \$/i, /^unsold auction\b/i, /winner (declined|no show)/i],
    confidence: 0.9,
  },
  {
    category: "Unit no longer proceeding to auction",
    responsibleParty: "No Delay",
    rootCause: "Unit was paid, redeemed, or otherwise removed from the auction pipeline",
    patterns: [
      /\bpaid( current| in full| balance)?\b/i,
      /\bredeemed\b/i,
      /vacated|no longer (going to |proceeding to )?auction|unit (was )?removed/i,
    ],
    confidence: 0.9,
  },
  {
    category: "BOG unavailable / turnover",
    responsibleParty: "BOG",
    rootCause: "No BOG currently assigned, or a BOG staffing change puts the photo request at risk",
    patterns: [/no bog\b/i, /bog terminated/i, /new bog hired/i, /\bbog\b.{0,15}(fired|replaced|quit|left)/i],
    confidence: 0.85,
  },
  {
    category: "BOG no response",
    responsibleParty: "BOG",
    rootCause: "BOG has not responded to the photo request",
    patterns: [
      /bog.{0,20}(no response|not respond|never respond|hasn'?t respond|no reply|ignor)/i,
      /bog.{0,20}(hasn'?t|has not|isn'?t|is not).{0,15}(respon)/i,
      /no response from bog/i,
      /no photos received as of/i,
      /did not get photos/i,
    ],
    confidence: 0.85,
  },
  {
    category: "BOG delayed response",
    responsibleParty: "BOG",
    rootCause: "Photo request required one or more follow-ups before resolution",
    patterns: [
      /bog.{0,25}(twice|multiple times|several times|again|follow(ed)?[ -]?up|still waiting|delay)/i,
      /(reached out|contacted|followed up).{0,20}bog/i,
      /request(ed)?[^.]{0,10}(on\s)?\d{1,2}[.\/]\d{1,2}[\s\S]{0,80}follow(ed)?[\s-]?up/i,
      /\d{1,2}[.\/]\d{1,2}.{0,10}(pics?|photos?) requested.{0,40},.{0,10}\d{1,2}[.\/]\d{1,2}.{0,15}follow[\s-]?up/i,
    ],
    confidence: 0.75,
  },
  {
    category: "BOG delayed response",
    responsibleParty: "BOG",
    rootCause: "Photo request submitted through BOG, awaiting resolution",
    patterns: [/requested (via|from|through) bog/i],
    confidence: 0.55,
  },
  {
    category: "Owner delay",
    responsibleParty: "Owner",
    rootCause: "Owner is working directly with the tenant, pausing the standard auction/photo process",
    patterns: [
      /owner (is )?working with (the )?tenant/i,
      /working with owner(ship)?/i,
      /paused per owner/i,
      /owner (will allow|asked)/i,
    ],
    confidence: 0.8,
  },
  {
    category: "Owner delay",
    responsibleParty: "Owner",
    rootCause: "Site manager had to contact the facility owner directly to move the request forward",
    patterns: [/sent owner an? email/i, /(waiting on|wait(ing)? for) owner/i, /owner (to|will) (upload|send|provide)/i],
    confidence: 0.75,
  },
  {
    category: "Owner failed to provide photos",
    responsibleParty: "Owner",
    rootCause: "Facility owner has not supplied the required photos",
    patterns: [/owner.{0,20}(didn'?t|did not|hasn'?t|has not|failed to|no).{0,15}(provide|send|upload|photo)/i],
    confidence: 0.85,
  },
  {
    category: "Owner delay",
    responsibleParty: "Owner",
    rootCause: "Owner unavailable or slow to act",
    patterns: [/owner.{0,20}(unavailable|delay|busy|out of (town|office)|not available)/i],
    confidence: 0.8,
  },
  {
    category: "Facility on hold / offboarding",
    responsibleParty: "Other",
    rootCause: "Facility is under review for offboarding or reduced services, pausing the auction pipeline",
    patterns: [/offboarding|reducing services|facility may be/i],
    confidence: 0.85,
  },
  {
    category: "Access issue",
    responsibleParty: "Other",
    rootCause: "Physical access or equipment issue prevented photos from being taken",
    patterns: [
      /(access issue|couldn'?t access|no access|lock(ed)? ?out|gate code|lock cut)/i,
      /(latch|door|lock).{0,20}(fixed|fixing|broken|off track).{0,10}(by )?(vendor)?/i,
      /vendor.{0,15}(fixing|fixed|repair)/i,
      /can ?not get auction photos/i,
    ],
    confidence: 0.75,
  },
  {
    category: "Scheduling issue",
    responsibleParty: "Other",
    rootCause: "Photo or auction appointment could not be scheduled in time",
    patterns: [/(reschedul|scheduling conflict|no availability|couldn'?t schedule|scheduling tow)/i],
    confidence: 0.7,
  },
  {
    category: "Incorrect / missing information",
    responsibleParty: "Site Manager",
    rootCause: "Contact or unit information was wrong, causing delay",
    patterns: [/(wrong (contact|number|email)|incorrect (info|information|contact)|missing information)/i],
    confidence: 0.75,
  },
  {
    category: "Site Manager follow-up issue",
    responsibleParty: "Site Manager",
    rootCause: "Follow-up from the site manager was delayed or incomplete",
    patterns: [/(sm forgot|manager (didn'?t|did not) follow|no follow[ -]?up from (sm|manager|site))/i],
    confidence: 0.7,
  },
  {
    category: "Other",
    responsibleParty: "No Delay",
    rootCause: "Unit reported vacant or empty; unclear whether this affected the photo request",
    patterns: [/^vacant$/i, /found empty/i, /^empty\b/i],
    confidence: 0.55,
  },
  {
    category: "Other",
    responsibleParty: "Other",
    rootCause: "Unit was not ready for photos at time of request",
    patterns: [/unit (was )?not ready/i],
    confidence: 0.7,
  },
  {
    category: "Other",
    responsibleParty: "No Delay",
    rootCause: "Note describes post-sale buyer/logistics instructions, not a photo-request issue",
    patterns: [/buyer must go to the office/i, /provide auction winner with/i, /vehicle in unit/i],
    confidence: 0.6,
  },
];

export function classifyNote(note: string): ClassificationResult {
  const text = (note || "").trim();

  if (!text) {
    return {
      category: "Unknown",
      responsibleParty: "Unknown",
      rootCause: "No notes available to determine cause",
      confidence: 0,
      needsReview: true,
    };
  }

  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return {
        category: rule.category,
        responsibleParty: rule.responsibleParty,
        rootCause: rule.rootCause,
        confidence: rule.confidence,
        needsReview: rule.confidence < 0.75,
      };
    }
  }

  // Generic "bog" or "owner" mention without a clear pattern match — flag for review
  // rather than guessing at fault, per the safeguard against assuming BOG blame.
  if (/bog/i.test(text)) {
    return {
      category: "Other",
      responsibleParty: "Unknown",
      rootCause: "Note references BOG but the specific issue is unclear",
      confidence: 0.4,
      needsReview: true,
    };
  }
  if (/owner/i.test(text)) {
    return {
      category: "Other",
      responsibleParty: "Unknown",
      rootCause: "Note references the owner but the specific issue is unclear",
      confidence: 0.4,
      needsReview: true,
    };
  }

  return {
    category: "Unknown",
    responsibleParty: "Unknown",
    rootCause: "Notes did not match a known issue pattern",
    confidence: 0.3,
    needsReview: true,
  };
}
