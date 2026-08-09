import type { AIIssueCategory, ResponsibleParty } from "./types";

// Heuristic free-text classifier standing in for an LLM-based classification
// step. It never invents a responsible party it can't support in the text —
// ambiguous or unmatched notes fall through to "Unknown" per the spec's
// safeguard against automatically blaming BOG.
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
    ],
    confidence: 0.95,
  },
  {
    category: "BOG no response",
    responsibleParty: "BOG",
    rootCause: "BOG has not responded to the photo request",
    patterns: [/bog.{0,20}(no response|not respond|never respond|hasn'?t respond|no reply|ignor)/i, /no response from bog/i],
    confidence: 0.9,
  },
  {
    category: "BOG delayed response",
    responsibleParty: "BOG",
    rootCause: "BOG responded, but only after repeated follow-up",
    patterns: [
      /bog.{0,25}(twice|multiple times|several times|again|follow(ed)?[ -]?up|still waiting|delay)/i,
      /(reached out|contacted|followed up).{0,20}bog/i,
    ],
    confidence: 0.85,
  },
  {
    category: "Owner failed to provide photos",
    responsibleParty: "Owner",
    rootCause: "Facility owner has not supplied the required photos",
    patterns: [
      /owner.{0,20}(didn'?t|did not|hasn'?t|has not|failed to|no).{0,15}(provide|send|upload|photo)/i,
      /(waiting on|wait(ing)? for) owner/i,
      /owner (to|will) (upload|send|provide)/i,
    ],
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
    category: "Access issue",
    responsibleParty: "Other",
    rootCause: "Physical access to the unit prevented photos from being taken",
    patterns: [/(access issue|couldn'?t access|no access|lock(ed)? ?out|gate code|lock cut)/i],
    confidence: 0.75,
  },
  {
    category: "Scheduling issue",
    responsibleParty: "Other",
    rootCause: "Photo appointment could not be scheduled in time",
    patterns: [/(reschedul|scheduling conflict|no availability|couldn'?t schedule)/i],
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
    category: "Unit no longer proceeding to auction",
    responsibleParty: "No Delay",
    rootCause: "Unit was paid, vacated, or otherwise removed from the auction pipeline",
    patterns: [/(paid off|paid in full|vacated|no longer (going to |proceeding to )?auction|unit (was )?removed|redeemed)/i],
    confidence: 0.9,
  },
];

const UNIT_NOT_READY: Rule = {
  category: "Other",
  responsibleParty: "Other",
  rootCause: "Unit was not ready for photos at time of request",
  patterns: [/unit (was )?not ready/i],
  confidence: 0.7,
};
RULES.push(UNIT_NOT_READY);

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
