/**
 * AI-powered trip report parser using Claude.
 *
 * Given the raw text of an EGS BD/AM trip report, this module:
 *  1. Sends the text to Claude with a structured extraction prompt.
 *  2. Parses the JSON response into typed objects.
 *  3. Writes the extracted data into the database via `storage`.
 *
 * The parser is forgiving: it creates new companies / contacts / games /
 * platform-topics if they don't already exist, and re-uses existing ones
 * when a name match is found (case-insensitive).
 */

import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { log } from "./index";

// ─── Types returned by Claude ────────────────────────────────────────────────

interface ParsedContact {
  name: string;
  title?: string;
  email?: string;
}

interface ParsedGame {
  title: string;
  egsStatus?: "launched" | "announced" | "under_discussion" | "not_coming" | "unknown";
  dealStatus?: "initial_outreach" | "in_negotiation" | "signed" | "lost";
  discussionSummary?: string;
  sentiment?: "positive" | "neutral" | "negative";
  projectedLaunchTiming?: string;
  keyQuotes?: string;
}

interface ParsedTopic {
  name: string;
  category?: "commercial" | "product" | "tech" | "marketing" | "operations";
  sentiment?: "positive" | "neutral" | "negative";
  feedbackSummary?: string;
  requestOrBlocker?: string;
  priority?: "low" | "medium" | "high";
}

interface ParsedMeeting {
  companyName: string;
  companyType?: "publisher" | "developer" | "mixed";
  companyRegion?: string;
  contacts: ParsedContact[];
  meetingDate?: string;         // YYYY-MM-DD
  startTime?: string;           // HH:MM
  location?: string;
  format?: "in_person" | "virtual" | "hybrid";
  overallSentiment: "positive" | "neutral" | "negative";
  summary: string;
  detailedNotes?: string;
  followUpActions?: string;
  games: ParsedGame[];
  topics: ParsedTopic[];
}

interface ParsedReport {
  meetings: ParsedMeeting[];
}

// ─── Claude extraction ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert at parsing Epic Games Store (EGS) business development trip reports.
Given a raw trip report document, extract ALL meetings, companies, contacts, games, and platform topics.

Return ONLY a valid JSON object matching this exact schema (no markdown fences, no extra text):

{
  "meetings": [
    {
      "companyName": "string — the publisher/developer company met with",
      "companyType": "publisher | developer | mixed",
      "companyRegion": "APAC | EMEA | NA | LATAM | Global (infer from context)",
      "contacts": [
        { "name": "string", "title": "string?", "email": "string?" }
      ],
      "meetingDate": "YYYY-MM-DD or null",
      "startTime": "HH:MM or null",
      "location": "string or null",
      "format": "in_person | virtual | hybrid",
      "overallSentiment": "positive | neutral | negative",
      "summary": "1-2 sentence summary of the meeting outcome",
      "detailedNotes": "full notes (preserve detail)",
      "followUpActions": "comma-separated list of follow-up actions",
      "games": [
        {
          "title": "game title",
          "egsStatus": "launched | announced | under_discussion | not_coming | unknown",
          "dealStatus": "initial_outreach | in_negotiation | signed | lost",
          "discussionSummary": "what was discussed",
          "sentiment": "positive | neutral | negative",
          "projectedLaunchTiming": "e.g. Q4 2026 or null",
          "keyQuotes": "direct quotes from the contact about this game or null"
        }
      ],
      "topics": [
        {
          "name": "platform topic name (e.g. Revenue Share / Commercial Terms, Discovery & Featuring, Tools & SDK, Payments & Reporting, User Acquisition & Marketing)",
          "category": "commercial | product | tech | marketing | operations",
          "sentiment": "positive | neutral | negative",
          "feedbackSummary": "what was said",
          "requestOrBlocker": "specific request or blocker mentioned or null",
          "priority": "low | medium | high"
        }
      ]
    }
  ]
}

Rules:
- Extract every distinct meeting block even if format is loose.
- If the document has no clear meeting structure, treat the whole document as one meeting.
- For sentiment: positive = excited/interested/committed, negative = rejected/blocked/concerns, neutral = unclear/mixed.
- Map platform topics to the canonical EGS topic names when possible.
- For dates, infer the year from context (event year) if only month/day is given.
- Omit null/undefined optional fields rather than including them as null.`;

async function callClaude(rawText: string): Promise<ParsedReport> {
  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Parse the following EGS trip report and extract all structured data:\n\n---\n${rawText}\n---`,
      },
    ],
    system: SYSTEM_PROMPT,
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Strip any accidental markdown fences
  const cleaned = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

  try {
    return JSON.parse(cleaned) as ParsedReport;
  } catch {
    throw new Error(`Claude returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
}

// ─── Helper: find-or-create helpers ──────────────────────────────────────────

async function findOrCreateCompany(
  name: string,
  type?: "publisher" | "developer" | "mixed",
  region?: string
): Promise<number> {
  const all = await storage.getCompanies();
  const existing = all.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const created = await storage.createCompany({
    name,
    companyType: type ?? "developer",
    region: region ?? null,
    notes: null,
  });
  return created.id;
}

async function findOrCreateContact(
  companyId: number,
  name: string,
  title?: string,
  email?: string
): Promise<number> {
  const all = await storage.getContactsByCompany(companyId);
  const existing = all.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const created = await storage.createContact({
    companyId,
    name,
    title: title ?? null,
    email: email ?? null,
    phone: null,
    notes: null,
  });
  return created.id;
}

async function findOrCreateGame(
  title: string,
  companyId: number,
  egsStatus?: string
): Promise<number> {
  const all = await storage.getGames();
  const existing = all.find((g) => g.title.toLowerCase() === title.toLowerCase());
  if (existing) return existing.id;
  const validStatus = ["launched", "announced", "under_discussion", "not_coming", "unknown"];
  const created = await storage.createGame({
    title,
    developerCompanyId: companyId,
    publisherCompanyId: companyId,
    currentEgsStatus: validStatus.includes(egsStatus ?? "") ? (egsStatus as any) : "unknown",
    notes: null,
  });
  return created.id;
}

async function findOrCreateTopic(
  name: string,
  category?: string
): Promise<number> {
  const all = await storage.getPlatformTopics();
  const existing = all.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const validCats = ["commercial", "product", "tech", "marketing", "operations"];
  const created = await storage.createPlatformTopic({
    name,
    category: validCats.includes(category ?? "") ? (category as any) : "product",
    description: null,
  });
  return created.id;
}

// ─── Main parse function ──────────────────────────────────────────────────────

export interface ParseResult {
  meetingsCreated: number;
  companiesCreated: number;
  contactsCreated: number;
  gamesCreated: number;
  topicsCreated: number;
  errors: string[];
}

export async function parseAndIngest(
  sourceDocumentId: number,
  eventId: number,
  rawText: string
): Promise<ParseResult> {
  const result: ParseResult = {
    meetingsCreated: 0,
    companiesCreated: 0,
    contactsCreated: 0,
    gamesCreated: 0,
    topicsCreated: 0,
    errors: [],
  };

  // Track new company/game/topic counts by checking before vs after
  const companiesBefore = (await storage.getCompanies()).length;
  const gamesBefore = (await storage.getGames()).length;
  const topicsBefore = (await storage.getPlatformTopics()).length;

  let parsed: ParsedReport;
  try {
    parsed = await callClaude(rawText);
  } catch (err: any) {
    result.errors.push(`LLM parse error: ${err.message}`);
    return result;
  }

  if (!parsed.meetings || parsed.meetings.length === 0) {
    result.errors.push("No meetings extracted from document");
    return result;
  }

  for (const pm of parsed.meetings) {
    try {
      // Company
      const companyId = await findOrCreateCompany(
        pm.companyName,
        pm.companyType,
        pm.companyRegion
      );

      // Meeting
      const meeting = await storage.createMeeting({
        eventId,
        companyId,
        meetingDate: pm.meetingDate ?? null,
        startTime: pm.startTime ?? null,
        endTime: null,
        location: pm.location ?? null,
        format: pm.format ?? "in_person",
        overallSentiment: pm.overallSentiment ?? "neutral",
        summary: pm.summary ?? "",
        detailedNotes: pm.detailedNotes ?? null,
        followUpActions: pm.followUpActions ?? null,
        followUpOwnerUserId: null,
        followUpDueDate: null,
      });
      result.meetingsCreated++;

      // Contacts
      for (const pc of pm.contacts ?? []) {
        const contactId = await findOrCreateContact(
          companyId,
          pc.name,
          pc.title,
          pc.email
        );
        result.contactsCreated++;
        await storage.addMeetingContact({
          meetingId: meeting.id,
          contactId,
          roleInMeeting: "Attendee",
        });
      }

      // Games
      for (const pg of pm.games ?? []) {
        const gameId = await findOrCreateGame(pg.title, companyId, pg.egsStatus);
        result.gamesCreated++;
        const validSentiments = ["positive", "neutral", "negative"];
        const validDealStatuses = ["initial_outreach", "in_negotiation", "signed", "lost"];
        await storage.addMeetingGame({
          meetingId: meeting.id,
          gameId,
          gameSpecificSentiment: validSentiments.includes(pg.sentiment ?? "") ? (pg.sentiment as any) : "neutral",
          discussionSummary: pg.discussionSummary ?? null,
          dealStatus: validDealStatuses.includes(pg.dealStatus ?? "") ? (pg.dealStatus as any) : null,
          projectedLaunchTiming: pg.projectedLaunchTiming ?? null,
          keyQuotes: pg.keyQuotes ?? null,
        });
      }

      // Platform Topics
      for (const pt of pm.topics ?? []) {
        const topicId = await findOrCreateTopic(pt.name, pt.category);
        result.topicsCreated++;
        const validSentiments = ["positive", "neutral", "negative"];
        const validPriorities = ["low", "medium", "high"];
        await storage.addMeetingTopic({
          meetingId: meeting.id,
          topicId,
          sentiment: validSentiments.includes(pt.sentiment ?? "") ? (pt.sentiment as any) : "neutral",
          feedbackSummary: pt.feedbackSummary ?? null,
          requestOrBlocker: pt.requestOrBlocker ?? null,
          priority: validPriorities.includes(pt.priority ?? "") ? (pt.priority as any) : "medium",
        });
      }
    } catch (err: any) {
      result.errors.push(`Meeting "${pm.companyName}": ${err.message}`);
    }
  }

  const companiesAfter = (await storage.getCompanies()).length;
  const gamesAfter = (await storage.getGames()).length;
  const topicsAfter = (await storage.getPlatformTopics()).length;

  result.companiesCreated = companiesAfter - companiesBefore;
  result.gamesCreated = gamesAfter - gamesBefore;
  result.topicsCreated = topicsAfter - topicsBefore;

  log(
    `[parser] doc=${sourceDocumentId} meetings=${result.meetingsCreated} companies=${result.companiesCreated} contacts=${result.contactsCreated} games=${result.gamesCreated} topics=${result.topicsCreated} errors=${result.errors.length}`,
    "parser"
  );

  return result;
}
