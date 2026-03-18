/**
 * Runs Drizzle migrations and seeds initial data if the DB is empty.
 * Called once at server startup.
 */
import { db } from "./db";
import {
  users, events, eventAttendees, companies, contacts,
  meetings, meetingContacts, games, meetingGames,
  platformTopics, meetingTopics, eventExecutiveSummaries,
  sourceDocuments,
} from "@shared/schema";
import { sql, count } from "drizzle-orm";

function log(msg: string) {
  console.log(`${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })} [migrate] ${msg}`);
}

async function tableExists(tableName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
    )
  `);
  return (result.rows[0] as any).exists === true;
}

async function createTablesIfNotExist() {
  // Create enums
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE event_type AS ENUM ('conference','roadshow','virtual','other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE sentiment AS ENUM ('positive','neutral','negative');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE meeting_format AS ENUM ('in_person','virtual','hybrid');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE egs_status AS ENUM ('launched','announced','under_discussion','not_coming','unknown');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE deal_status AS ENUM ('initial_outreach','in_negotiation','signed','lost');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE topic_category AS ENUM ('commercial','product','tech','marketing','operations');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE priority AS ENUM ('low','medium','high');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE company_type AS ENUM ('publisher','developer','mixed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE source_type AS ENUM ('pasted_text','google_doc','pdf_file','word_file','other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE parsing_status AS ENUM ('pending','success','failed','partially_parsed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE section_type AS ENUM ('event_header','meeting_block','game_block','topic_block','other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('admin','bd','am','viewer');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // Create tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role user_role NOT NULL DEFAULT 'am',
      team TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      event_type event_type NOT NULL DEFAULT 'conference',
      start_date DATE,
      end_date DATE,
      city TEXT,
      country TEXT,
      primary_owner_user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_attendees (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      role_at_event TEXT
    );

    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      company_type company_type NOT NULL DEFAULT 'developer',
      region TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      title TEXT,
      email TEXT,
      phone TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      company_id INTEGER REFERENCES companies(id),
      meeting_date DATE,
      start_time TIME,
      end_time TIME,
      location TEXT,
      format meeting_format NOT NULL DEFAULT 'in_person',
      overall_sentiment sentiment NOT NULL DEFAULT 'neutral',
      summary TEXT,
      detailed_notes TEXT,
      follow_up_actions TEXT,
      follow_up_owner_user_id INTEGER REFERENCES users(id),
      follow_up_due_date DATE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meeting_contacts (
      id SERIAL PRIMARY KEY,
      meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id),
      role_in_meeting TEXT
    );

    CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      developer_company_id INTEGER REFERENCES companies(id),
      publisher_company_id INTEGER REFERENCES companies(id),
      current_egs_status egs_status NOT NULL DEFAULT 'unknown',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meeting_games (
      id SERIAL PRIMARY KEY,
      meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      game_id INTEGER NOT NULL REFERENCES games(id),
      game_specific_sentiment sentiment,
      discussion_summary TEXT,
      deal_status deal_status,
      projected_launch_timing TEXT,
      key_quotes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_topics (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category topic_category NOT NULL DEFAULT 'product',
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meeting_topics (
      id SERIAL PRIMARY KEY,
      meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      topic_id INTEGER NOT NULL REFERENCES platform_topics(id),
      sentiment sentiment NOT NULL DEFAULT 'neutral',
      feedback_summary TEXT,
      request_or_blocker TEXT,
      priority priority NOT NULL DEFAULT 'medium',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_executive_summaries (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
      macro_themes TEXT,
      highlights TEXT,
      negatives TEXT,
      recommendations TEXT,
      top_opportunities JSON,
      top_risks JSON,
      top_actions JSON,
      generated_at TIMESTAMP DEFAULT NOW(),
      last_refreshed_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS global_summaries (
      id SERIAL PRIMARY KEY,
      snapshot_date DATE NOT NULL,
      games_summary JSON,
      topics_summary JSON,
      key_recommendations TEXT,
      generated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_documents (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      source_type source_type NOT NULL,
      original_file_name TEXT,
      external_url TEXT,
      storage_path_or_id TEXT,
      uploaded_by_user_id INTEGER REFERENCES users(id),
      uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL,
      parsing_status parsing_status NOT NULL DEFAULT 'pending',
      parsing_log TEXT,
      raw_text_excerpt TEXT,
      raw_text TEXT
    );

    CREATE TABLE IF NOT EXISTS parsed_sections (
      id SERIAL PRIMARY KEY,
      source_document_id INTEGER NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
      section_type section_type NOT NULL DEFAULT 'other',
      linked_meeting_id INTEGER REFERENCES meetings(id),
      linked_game_id INTEGER REFERENCES games(id),
      linked_topic_id INTEGER REFERENCES platform_topics(id),
      section_text TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);
}

async function seedIfEmpty() {
  const userCount = await db.select({ count: count() }).from(users);
  if (Number(userCount[0].count) > 0) {
    log("DB already seeded — skipping seed");
    return;
  }

  log("Seeding initial data...");

  // Users
  const [u1, u2, u3] = await db.insert(users).values([
    { name: "Alex Chen", email: "alex.chen@epicgames.com", role: "bd", team: "Publisher BD - APAC" },
    { name: "Jordan Rivera", email: "jordan.rivera@epicgames.com", role: "am", team: "Account Management - EMEA" },
    { name: "Sam Park", email: "sam.park@epicgames.com", role: "bd", team: "Publisher BD - NA" },
  ]).returning();

  // Companies
  const [c1, c2, c3, c4] = await db.insert(companies).values([
    { name: "Nexon Games", companyType: "developer", region: "APAC" },
    { name: "505 Games", companyType: "publisher", region: "EMEA" },
    { name: "Devolver Digital", companyType: "publisher", region: "NA", notes: "Indie publisher, anti-AAA positioning" },
    { name: "Thunderful Group", companyType: "mixed", region: "EMEA" },
  ]).returning();

  // Contacts
  const [ct1, ct2, ct3, ct4] = await db.insert(contacts).values([
    { companyId: c1.id, name: "Yuki Tanaka", title: "Head of PC Publishing", email: "y.tanaka@nexon.com" },
    { companyId: c2.id, name: "Marco Bianchi", title: "VP Partnerships", email: "m.bianchi@505games.com", notes: "Key decision maker" },
    { companyId: c3.id, name: "Graeme Struthers", title: "Co-Founder", notes: "Skeptical of exclusivity deals" },
    { companyId: c4.id, name: "Bo Andersson", title: "CEO", email: "b.andersson@thunderful.se" },
  ]).returning();

  // Platform topics
  const [pt1, pt2, pt3, pt4, pt5] = await db.insert(platformTopics).values([
    { name: "Revenue Share / Commercial Terms", category: "commercial", description: "88/12 split discussion, MFN clauses, launch bonuses" },
    { name: "Discovery & Featuring", category: "product", description: "Store front visibility, editorial featuring, search ranking" },
    { name: "Tools & SDK", category: "tech", description: "EOS integration complexity, overlay features, achievement system" },
    { name: "Payments & Reporting", category: "operations", description: "Analytics dashboard, payment timelines, currency support" },
    { name: "User Acquisition & Marketing", category: "marketing", description: "Free games program, launch marketing support, UA budget" },
  ]).returning();

  // Games
  const [g1, g2, g3, g4, g5] = await db.insert(games).values([
    { title: "Vindictus: Defying Fate", developerCompanyId: c1.id, publisherCompanyId: c1.id, currentEgsStatus: "announced", notes: "Action RPG. Announced for EGS 2026." },
    { title: "Ghostrunner 3", developerCompanyId: c2.id, publisherCompanyId: c2.id, currentEgsStatus: "under_discussion", notes: "505 asking for 90-day exclusivity window pricing." },
    { title: "Skald: Against the Black Priory 2", developerCompanyId: c4.id, publisherCompanyId: c4.id, currentEgsStatus: "not_coming", notes: "Thunderful confirmed Steam-only for now." },
    { title: "Metal: Hellsinger 2", developerCompanyId: c4.id, publisherCompanyId: c4.id, currentEgsStatus: "unknown", notes: "Early discussions, no commitment." },
    { title: "Devolver Arcade Collection", developerCompanyId: c3.id, publisherCompanyId: c3.id, currentEgsStatus: "not_coming", notes: "Devolver explicitly said no EGS launches planned." },
  ]).returning();

  // Events
  const [e1, e2, e3] = await db.insert(events).values([
    { name: "GDC 2026", description: "Game Developers Conference, Moscone Center", eventType: "conference", startDate: "2026-03-17", endDate: "2026-03-21", city: "San Francisco", country: "USA", primaryOwnerUserId: u1.id },
    { name: "Gamescom 2025", description: "World's largest gaming expo", eventType: "conference", startDate: "2025-08-20", endDate: "2025-08-24", city: "Cologne", country: "Germany", primaryOwnerUserId: u2.id },
    { name: "Tokyo Publisher Roadshow Q1 2026", description: "BD roadshow targeting APAC publishers", eventType: "roadshow", startDate: "2026-01-15", endDate: "2026-01-18", city: "Tokyo", country: "Japan", primaryOwnerUserId: u1.id },
  ]).returning();

  // Event attendees
  await db.insert(eventAttendees).values([
    { eventId: e1.id, userId: u1.id, roleAtEvent: "Lead BD" },
    { eventId: e1.id, userId: u3.id, roleAtEvent: "BD Support" },
    { eventId: e2.id, userId: u2.id, roleAtEvent: "Lead AM" },
    { eventId: e3.id, userId: u1.id, roleAtEvent: "Lead BD" },
  ]);

  // Meetings
  const [m1, m2, m3, m4, m5] = await db.insert(meetings).values([
    { eventId: e1.id, companyId: c1.id, meetingDate: "2026-03-18", startTime: "10:00", endTime: "10:45", location: "Room 3006, Moscone North", format: "in_person", overallSentiment: "positive", summary: "Nexon confirmed Vindictus: Defying Fate for EGS. Excited about 88/12 split and launch bonus structure. Timeline aligned for Q4 2026.", detailedNotes: "Yuki opened with strong interest in EGS DAU growth. We discussed the launch bonus structure for titles in 2026. She confirmed Vindictus: Defying Fate will come to EGS. Revenue share was praised. Main ask: better analytics dashboard before launch.", followUpActions: "Share updated analytics roadmap. Schedule April call.", followUpOwnerUserId: u1.id, followUpDueDate: "2026-04-01" },
    { eventId: e1.id, companyId: c2.id, meetingDate: "2026-03-18", startTime: "14:00", endTime: "15:00", location: "Room 2016, Moscone West", format: "in_person", overallSentiment: "neutral", summary: "505 Games is interested in Ghostrunner 3 on EGS but wants MFN clause clarification and a minimum guarantee discussion. No commitment yet.", detailedNotes: "Marco led the discussion. They are currently in talks with Steam about a Ghostrunner 3 date. MFN clause applicability for DLC is unclear. Requested a follow-up with legal.", followUpActions: "Send MFN clause summary. Loop in Legal team.", followUpOwnerUserId: u3.id, followUpDueDate: "2026-03-28" },
    { eventId: e1.id, companyId: c3.id, meetingDate: "2026-03-19", startTime: "11:00", endTime: "11:30", location: "Devolver Suite, Marriott Marquis", format: "in_person", overallSentiment: "negative", summary: "Devolver Digital will not be bringing any games to EGS this year. Graeme cited user acquisition concerns and integration overhead as blockers.", detailedNotes: "Graeme was direct: Devolver has no plans to ship on EGS in 2026. He cited low EGS UA relative to Steam. EOS SDK integration described as 'annoying overhead'. Open to revisiting in 2027 if UA metrics improve.", followUpActions: "Monitor Devolver game launches on Steam. Re-approach in late 2026.", followUpOwnerUserId: u3.id, followUpDueDate: "2026-11-01" },
    { eventId: e2.id, companyId: c4.id, meetingDate: "2025-08-21", startTime: "09:30", endTime: "10:15", location: "Business Area Hall 4.2, Messe Köln", format: "in_person", overallSentiment: "negative", summary: "Thunderful Group confirmed Skald 2 is Steam-only. Metal: Hellsinger 2 is undecided. Concerns about EGS tooling and lower sales projections.", detailedNotes: "Bo was candid that EGS sales for their prior titles were significantly below Steam. Skald 2 confirmed Steam-only. Open to Metal: Hellsinger 2 on EGS with minimum guaranteed sales or marketing spend.", followUpActions: "Internal: explore Min Guarantee structure for Thunderful. Share EOS achievement roadmap.", followUpOwnerUserId: u2.id, followUpDueDate: "2025-09-15" },
    { eventId: e3.id, companyId: c1.id, meetingDate: "2026-01-16", startTime: "13:00", endTime: "14:00", location: "Andaz Tokyo, Meeting Room B", format: "in_person", overallSentiment: "positive", summary: "Strong follow-up from GDC conversation. Nexon confirmed additional 3 titles for EGS evaluation in 2026-2027 pipeline. Contract terms agreed in principle.", detailedNotes: "Yuki brought her PC lead and a BD coordinator. Confirmed 3 additional titles beyond Vindictus for EGS. Commercial terms agreed in principle — formal term sheet to follow.", followUpActions: "Send term sheet draft. Confirm analytics timeline with product.", followUpOwnerUserId: u1.id, followUpDueDate: "2026-01-30" },
  ]).returning();

  // Meeting contacts
  await db.insert(meetingContacts).values([
    { meetingId: m1.id, contactId: ct1.id, roleInMeeting: "Lead" },
    { meetingId: m2.id, contactId: ct2.id, roleInMeeting: "Lead" },
    { meetingId: m3.id, contactId: ct3.id, roleInMeeting: "Lead" },
    { meetingId: m4.id, contactId: ct4.id, roleInMeeting: "Lead" },
    { meetingId: m5.id, contactId: ct1.id, roleInMeeting: "Lead" },
  ]);

  // Meeting games
  await db.insert(meetingGames).values([
    { meetingId: m1.id, gameId: g1.id, gameSpecificSentiment: "positive", discussionSummary: "Confirmed for EGS Q4 2026. Launch bonus accepted.", dealStatus: "signed", projectedLaunchTiming: "Q4 2026", keyQuotes: '"We are very excited about Epic\'s platform direction" — Yuki Tanaka' },
    { meetingId: m2.id, gameId: g2.id, gameSpecificSentiment: "neutral", discussionSummary: "MFN clause under review. No timeline set.", dealStatus: "in_negotiation" },
    { meetingId: m3.id, gameId: g5.id, gameSpecificSentiment: "negative", discussionSummary: "No EGS release planned. SDK overhead cited.", dealStatus: "lost", keyQuotes: '"EGS UA is just not there for our catalog" — Graeme Struthers' },
    { meetingId: m4.id, gameId: g3.id, gameSpecificSentiment: "negative", discussionSummary: "Confirmed Steam-only.", dealStatus: "lost" },
    { meetingId: m4.id, gameId: g4.id, gameSpecificSentiment: "neutral", discussionSummary: "Under consideration pending minimum guarantee.", dealStatus: "initial_outreach", projectedLaunchTiming: "TBD 2026" },
    { meetingId: m5.id, gameId: g1.id, gameSpecificSentiment: "positive", discussionSummary: "Terms agreed in principle. Term sheet pending.", dealStatus: "in_negotiation", projectedLaunchTiming: "Q4 2026" },
  ]);

  // Meeting topics
  await db.insert(meetingTopics).values([
    { meetingId: m1.id, topicId: pt1.id, sentiment: "positive", feedbackSummary: "88/12 praised. Launch bonus structure well received.", priority: "high" },
    { meetingId: m1.id, topicId: pt4.id, sentiment: "neutral", feedbackSummary: "Analytics dashboard needs improvement before launch.", requestOrBlocker: "Better analytics dashboard required", priority: "high" },
    { meetingId: m2.id, topicId: pt1.id, sentiment: "neutral", feedbackSummary: "MFN clause applicability for DLC is unclear.", requestOrBlocker: "Written MFN summary needed", priority: "medium" },
    { meetingId: m3.id, topicId: pt3.id, sentiment: "negative", feedbackSummary: "EOS SDK described as annoying overhead by Devolver.", requestOrBlocker: "SDK integration complexity", priority: "high" },
    { meetingId: m3.id, topicId: pt5.id, sentiment: "negative", feedbackSummary: "EGS UA metrics are too low compared to Steam for Devolver catalog.", requestOrBlocker: "Insufficient EGS UA", priority: "high" },
    { meetingId: m4.id, topicId: pt3.id, sentiment: "negative", feedbackSummary: "Achievement/trophy implementation needs work.", requestOrBlocker: "Achievement system improvement", priority: "medium" },
    { meetingId: m4.id, topicId: pt2.id, sentiment: "neutral", feedbackSummary: "Thunderful uncertain about EGS discoverability vs Steam.", priority: "medium" },
    { meetingId: m5.id, topicId: pt1.id, sentiment: "positive", feedbackSummary: "Commercial terms agreed in principle.", priority: "high" },
  ]);

  // Executive summaries
  await db.insert(eventExecutiveSummaries).values([
    {
      eventId: e1.id,
      macroThemes: "Strong positive signal from APAC publishers (Nexon) vs. resistance from established indie publishers (Devolver). SDK/tooling and UA concerns are consistent blockers among mid-tier developers.",
      highlights: "Nexon confirmed Vindictus: Defying Fate for EGS Q4 2026. Commercial terms accepted. 505 Games engaged on Ghostrunner 3 — MFN discussion ongoing.",
      negatives: "Devolver Digital explicitly stated no EGS games in 2026, citing low UA and EOS SDK overhead.",
      recommendations: "1. Prioritize EOS SDK simplification. 2. Develop a stronger UA case study for indie publishers. 3. Fast-track analytics dashboard improvements. 4. Explore min-guarantee structure with 505.",
      topOpportunities: JSON.stringify(["Vindictus: Defying Fate (Nexon) — Q4 2026 launch on track", "Ghostrunner 3 (505 Games) — active negotiation", "Nexon 3-title pipeline evaluation"]),
      topRisks: JSON.stringify(["Devolver Digital lost — SDK and UA concerns", "505 MFN clause unresolved", "Tooling gap cited by 2 out of 3 publishers"]),
      topActions: JSON.stringify([
        { action: "Share analytics roadmap with Nexon", owner: "Alex Chen", dueDate: "2026-04-01" },
        { action: "Send MFN clause summary to 505 Games", owner: "Sam Park", dueDate: "2026-03-28" },
        { action: "Internal review: min guarantee structure", owner: "Alex Chen", dueDate: "2026-04-05" },
      ]),
    },
    {
      eventId: e2.id,
      macroThemes: "EMEA publishers showing increased skepticism about EGS platform tooling and sales projections. Min-guarantee deal structure emerging as a potential unlocking mechanism.",
      highlights: "Productive meeting with Thunderful — Metal: Hellsinger 2 remains a possibility if commercial terms improve.",
      negatives: "Thunderful confirmed Skald 2 is Steam-only. Achievement system cited as an issue.",
      recommendations: "1. Develop a formal min-guarantee proposal for Thunderful. 2. Share EOS achievement roadmap. 3. Conduct portfolio analysis of EGS vs Steam performance.",
      topOpportunities: JSON.stringify(["Metal: Hellsinger 2 (Thunderful) — reachable with improved terms"]),
      topRisks: JSON.stringify(["Skald 2 confirmed lost", "Achievement system gap continues to hurt deals"]),
      topActions: JSON.stringify([
        { action: "Explore min-guarantee deal for Metal: Hellsinger 2", owner: "Jordan Rivera", dueDate: "2025-09-15" },
        { action: "Share EOS achievement system roadmap", owner: "Jordan Rivera", dueDate: "2025-09-10" },
      ]),
    },
  ]);

  // Source documents
  await db.insert(sourceDocuments).values([
    { eventId: e1.id, sourceType: "pasted_text", uploadedByUserId: u1.id, parsingStatus: "success", parsingLog: "Extracted 3 meeting blocks, 2 game mentions, 4 platform topic references.", rawTextExcerpt: "GDC 2026 Trip Report — Alex Chen...\n\n### Meeting: Nexon Games (Yuki Tanaka)\nDate: March 18, 10:00 AM\nSentiment: Very positive..." },
    { eventId: e2.id, sourceType: "google_doc", externalUrl: "https://docs.google.com/document/d/example-gamescom-2025", uploadedByUserId: u2.id, parsingStatus: "success", parsingLog: "Extracted 1 meeting block, 2 game mentions.", rawTextExcerpt: "Gamescom 2025 Notes — Jordan Rivera..." },
  ]);

  log("Seed complete");
}

export async function runMigrations() {
  log("Running migrations...");
  await createTablesIfNotExist();
  log("Tables ready");
  await seedIfEmpty();
}
