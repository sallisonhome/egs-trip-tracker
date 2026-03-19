import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import type { EventWithStats } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SentimentBar, SentimentBadge } from "@/components/sentiment-badge";
import { useToast } from "@/hooks/use-toast";
import { IngestModal } from "@/components/ingest-modal";
import {
  Plus, Search, MapPin, Calendar, Users, FileText,
  ChevronRight, Building2, Globe, UploadCloud
} from "lucide-react";
import { format } from "date-fns";

const eventTypeLabels: Record<string, string> = {
  conference: "Conference", roadshow: "Roadshow", virtual: "Virtual", other: "Other",
};

function getOverallSentiment(event: EventWithStats): "positive" | "neutral" | "negative" {
  if (event.negativeCount > event.positiveCount) return "negative";
  if (event.positiveCount >= event.neutralCount + event.negativeCount && event.positiveCount > 0) return "positive";
  return "neutral";
}

export default function EventListPage() {
  const { data: events, isLoading } = useQuery<EventWithStats[]>({ queryKey: ["/api/events"] });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [ingestOpen, setIngestOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", eventType: "conference", city: "", country: "", startDate: "", endDate: "" });

  const createEvent = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/events", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event created" });
      setNewEventOpen(false);
      setForm({ name: "", eventType: "conference", city: "", country: "", startDate: "", endDate: "" });
    },
  });

  const filtered = (events ?? []).filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.city ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || e.eventType === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Events & Trips</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All BD/AM field reports and event coverage</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIngestOpen(true)} data-testid="button-upload-report">
            <UploadCloud className="w-4 h-4 mr-1.5" />Upload Report
          </Button>
          <Button onClick={() => setNewEventOpen(true)} data-testid="button-new-event">
            <Plus className="w-4 h-4 mr-1.5" />New Event
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder="Search events or cities..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search-events"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-9" data-testid="select-event-type-filter">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="conference">Conference</SelectItem>
            <SelectItem value="roadshow">Roadshow</SelectItem>
            <SelectItem value="virtual">Virtual</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats row */}
      {events && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Events", value: events.length },
            { label: "Total Meetings", value: events.reduce((s, e) => s + e.meetingCount, 0) },
            { label: "Positive", value: events.reduce((s, e) => s + e.positiveCount, 0), color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Negative", value: events.reduce((s, e) => s + e.negativeCount, 0), color: "text-red-600 dark:text-red-400" },
          ].map(stat => (
            <Card key={stat.label} className="py-0">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-xl font-bold tabular-nums mt-0.5 ${stat.color ?? ""}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Event list */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      <div className="space-y-3" data-testid="event-list">
        {filtered.map(event => (
          <a key={event.id} href={`#/events/${event.id}`}>
            <Card className="hover-elevate cursor-pointer transition-all" data-testid={`event-card-${event.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{event.name}</span>
                      <Badge variant="outline" className="text-xs capitalize shrink-0">
                        {eventTypeLabels[event.eventType] ?? event.eventType}
                      </Badge>
                      {event.hasExecutiveSummary && (
                        <Badge className="text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                          Exec Summary
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {(event.city || event.country) && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {[event.city, event.country].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {event.startDate && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(event.startDate + "T12:00:00"), "MMM d")}
                          {event.endDate && event.endDate !== event.startDate &&
                            ` – ${format(new Date(event.endDate + "T12:00:00"), "MMM d, yyyy")}`
                          }
                          {(!event.endDate || event.endDate === event.startDate) &&
                            format(new Date(event.startDate + "T12:00:00"), ", yyyy")
                          }
                        </span>
                      )}
                      {event.primaryOwner && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          {event.primaryOwner.name}
                        </span>
                      )}
                      {event.sourceDocumentCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="w-3 h-3" />
                          {event.sourceDocumentCount} doc{event.sourceDocumentCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {event.meetingCount > 0 && (
                      <SentimentBar pos={event.positiveCount} neu={event.neutralCount} neg={event.negativeCount} />
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>

      {filtered.length === 0 && !isLoading && (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No events found</p>
          <p className="text-xs mt-1">Try adjusting your filters or create a new event</p>
        </div>
      )}

      {/* Ingest Modal */}
      <IngestModal open={ingestOpen} onOpenChange={setIngestOpen} />

      {/* New Event Dialog */}
      <Dialog open={newEventOpen} onOpenChange={setNewEventOpen}>
        <DialogContent data-testid="modal-new-event">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
            <DialogDescription>Add a conference, roadshow, or trip record</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label htmlFor="event-name">Event Name</Label>
              <Input id="event-name" data-testid="input-event-name" placeholder="e.g. GDC 2027" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="event-type">Type</Label>
                <Select value={form.eventType} onValueChange={v => setForm({ ...form, eventType: v })}>
                  <SelectTrigger className="mt-1" data-testid="select-event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conference">Conference</SelectItem>
                    <SelectItem value="roadshow">Roadshow</SelectItem>
                    <SelectItem value="virtual">Virtual</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="event-city">City</Label>
                <Input id="event-city" data-testid="input-event-city" placeholder="San Francisco" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="event-start">Start Date</Label>
                <Input id="event-start" type="date" data-testid="input-event-start" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="event-end">End Date</Label>
                <Input id="event-end" type="date" data-testid="input-event-end" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="mt-1" />
              </div>
            </div>
            <Button
              className="w-full mt-2"
              onClick={() => createEvent.mutate(form)}
              disabled={!form.name.trim() || createEvent.isPending}
              data-testid="button-create-event-submit"
            >
              {createEvent.isPending ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
