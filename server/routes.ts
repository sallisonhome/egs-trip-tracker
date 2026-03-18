import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import {
  insertEventSchema, insertMeetingSchema, insertCompanySchema,
  insertContactSchema, insertGameSchema, insertMeetingGameSchema,
  insertPlatformTopicSchema, insertMeetingTopicSchema,
  insertEventExecutiveSummarySchema, insertSourceDocumentSchema,
} from "@shared/schema";

export function registerRoutes(httpServer: Server, app: Express): Server {

  // ── Users ──
  app.get("/api/users", async (_req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  // ── Events ──
  app.get("/api/events", async (_req, res) => {
    const events = await storage.getEvents();
    res.json(events);
  });

  app.get("/api/events/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const event = await storage.getEventWithStats(id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  });

  app.post("/api/events", async (req, res) => {
    const parsed = insertEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const event = await storage.createEvent(parsed.data);
    res.status(201).json(event);
  });

  app.patch("/api/events/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const event = await storage.updateEvent(id, req.body);
    res.json(event);
  });

  app.delete("/api/events/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteEvent(id);
    res.status(204).send();
  });

  // ── Event Attendees ──
  app.get("/api/events/:id/attendees", async (req, res) => {
    const id = parseInt(req.params.id);
    const attendees = await storage.getEventAttendees(id);
    res.json(attendees);
  });

  // ── Meetings ──
  app.get("/api/events/:eventId/meetings", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    const meetings = await storage.getMeetingsByEvent(eventId);
    res.json(meetings);
  });

  app.get("/api/meetings/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const meeting = await storage.getMeetingById(id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    res.json(meeting);
  });

  app.post("/api/meetings", async (req, res) => {
    const parsed = insertMeetingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const meeting = await storage.createMeeting(parsed.data);
    res.status(201).json(meeting);
  });

  app.patch("/api/meetings/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const meeting = await storage.updateMeeting(id, req.body);
    res.json(meeting);
  });

  app.delete("/api/meetings/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteMeeting(id);
    res.status(204).send();
  });

  // ── Companies ──
  app.get("/api/companies", async (_req, res) => {
    const companies = await storage.getCompanies();
    res.json(companies);
  });

  app.post("/api/companies", async (req, res) => {
    const parsed = insertCompanySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const company = await storage.createCompany(parsed.data);
    res.status(201).json(company);
  });

  // ── Contacts ──
  app.get("/api/companies/:companyId/contacts", async (req, res) => {
    const companyId = parseInt(req.params.companyId);
    const contacts = await storage.getContactsByCompany(companyId);
    res.json(contacts);
  });

  app.post("/api/contacts", async (req, res) => {
    const parsed = insertContactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const contact = await storage.createContact(parsed.data);
    res.status(201).json(contact);
  });

  // ── Games ──
  app.get("/api/games", async (_req, res) => {
    const games = await storage.getGames();
    res.json(games);
  });

  app.get("/api/games/touchpoints", async (_req, res) => {
    const games = await storage.getGamesWithTouchpoints();
    res.json(games);
  });

  app.post("/api/games", async (req, res) => {
    const parsed = insertGameSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const game = await storage.createGame(parsed.data);
    res.status(201).json(game);
  });

  app.patch("/api/games/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const game = await storage.updateGame(id, req.body);
    res.json(game);
  });

  // ── Meeting Games ──
  app.post("/api/meetings/:meetingId/games", async (req, res) => {
    const meetingId = parseInt(req.params.meetingId);
    const parsed = insertMeetingGameSchema.safeParse({ ...req.body, meetingId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const mg = await storage.addMeetingGame(parsed.data);
    res.status(201).json(mg);
  });

  app.delete("/api/meeting-games/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.removeMeetingGame(id);
    res.status(204).send();
  });

  // ── Platform Topics ──
  app.get("/api/platform-topics", async (_req, res) => {
    const topics = await storage.getPlatformTopics();
    res.json(topics);
  });

  app.get("/api/platform-topics/stats", async (_req, res) => {
    const topics = await storage.getTopicsWithStats();
    res.json(topics);
  });

  app.post("/api/platform-topics", async (req, res) => {
    const parsed = insertPlatformTopicSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const topic = await storage.createPlatformTopic(parsed.data);
    res.status(201).json(topic);
  });

  // ── Meeting Topics ──
  app.post("/api/meetings/:meetingId/topics", async (req, res) => {
    const meetingId = parseInt(req.params.meetingId);
    const parsed = insertMeetingTopicSchema.safeParse({ ...req.body, meetingId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const mt = await storage.addMeetingTopic(parsed.data);
    res.status(201).json(mt);
  });

  app.delete("/api/meeting-topics/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.removeMeetingTopic(id);
    res.status(204).send();
  });

  // ── Executive Summaries ──
  app.get("/api/events/:eventId/executive-summary", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    const summary = await storage.getExecSummaryByEvent(eventId);
    if (!summary) return res.status(404).json({ message: "No executive summary found" });
    res.json(summary);
  });

  app.put("/api/events/:eventId/executive-summary", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    const parsed = insertEventExecutiveSummarySchema.safeParse({ ...req.body, eventId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const summary = await storage.upsertExecSummary(parsed.data);
    res.json(summary);
  });

  // ── Global Summary ──
  app.get("/api/global-summary", async (_req, res) => {
    const summary = await storage.getLatestGlobalSummary();
    res.json(summary ?? null);
  });

  // ── Source Documents ──
  app.get("/api/events/:eventId/source-documents", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    const docs = await storage.getSourceDocumentsByEvent(eventId);
    res.json(docs);
  });

  app.post("/api/source-documents", async (req, res) => {
    const parsed = insertSourceDocumentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const doc = await storage.createSourceDocument(parsed.data);
    // In production, this would trigger an async parsing pipeline.
    // For now we immediately mark as "success" with a stub log.
    const updated = await storage.updateSourceDocument(doc.id, {
      parsingStatus: "success",
      parsingLog: `Auto-parsed at ${new Date().toISOString()}. Detected source type: ${doc.sourceType}.`,
      rawTextExcerpt: (parsed.data.rawText ?? parsed.data.rawTextExcerpt ?? "").slice(0, 300),
    });
    res.status(201).json(updated);
  });

  app.patch("/api/source-documents/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const doc = await storage.updateSourceDocument(id, req.body);
    res.json(doc);
  });

  // ── Dashboard aggregates ──
  app.get("/api/dashboard", async (_req, res) => {
    const [gamesWithTP, topicsWithStats, events] = await Promise.all([
      storage.getGamesWithTouchpoints(),
      storage.getTopicsWithStats(),
      storage.getEvents(),
    ]);
    res.json({ gamesWithTouchpoints: gamesWithTP, topicsWithStats, events });
  });

  return httpServer;
}
