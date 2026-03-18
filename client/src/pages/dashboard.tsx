import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Game, PlatformTopic } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SentimentBadge, SentimentBar } from "@/components/sentiment-badge";
import {
  Gamepad2, MessageSquare, TrendingUp, TrendingDown, Minus,
  Target, LayoutDashboard, BarChart3
} from "lucide-react";

type GameWithTP = Game & { touchpointCount: number; sentiments: string[]; events: string[] };
type TopicWithStats = PlatformTopic & { feedbackCount: number; posCount: number; neutCount: number; negCount: number };

type DashboardData = {
  gamesWithTouchpoints: GameWithTP[];
  topicsWithStats: TopicWithStats[];
  events: { id: number; name: string; positiveCount: number; neutralCount: number; negativeCount: number; meetingCount: number }[];
};

const egsStatusColors: Record<string, string> = {
  launched: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  announced: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  under_discussion: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  not_coming: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800",
  unknown: "bg-muted text-muted-foreground",
};
const egsStatusLabels: Record<string, string> = {
  launched: "Launched", announced: "Announced", under_discussion: "Under Discussion", not_coming: "Not Coming", unknown: "Unknown",
};
const categoryColors: Record<string, string> = {
  commercial: "text-emerald-600 dark:text-emerald-400",
  product: "text-blue-600 dark:text-blue-400",
  tech: "text-purple-600 dark:text-purple-400",
  marketing: "text-orange-600 dark:text-orange-400",
  operations: "text-slate-600 dark:text-slate-400",
};

function overallSentiment(sentiments: string[]): "positive" | "neutral" | "negative" {
  const pos = sentiments.filter(s => s === "positive").length;
  const neg = sentiments.filter(s => s === "negative").length;
  if (neg > pos) return "negative";
  if (pos >= neg + (sentiments.length - pos - neg) && pos > 0) return "positive";
  return "neutral";
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard");
      return r.json();
    },
  });

  const totalMeetings = (data?.events ?? []).reduce((s, e) => s + e.meetingCount, 0);
  const totalPos = (data?.events ?? []).reduce((s, e) => s + e.positiveCount, 0);
  const totalNeg = (data?.events ?? []).reduce((s, e) => s + e.negativeCount, 0);
  const totalNeu = (data?.events ?? []).reduce((s, e) => s + e.neutralCount, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-primary" />
            Games & Topics Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cross-event insights — recurring games, platform feedback trends</p>
        </div>
      </div>

      {/* Global stats */}
      {data && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Events", value: data.events.length },
            { label: "Total Meetings", value: totalMeetings },
            { label: "Tracked Games", value: data.gamesWithTouchpoints.length },
            { label: "Platform Topics", value: data.topicsWithStats.length },
          ].map(s => (
            <Card key={s.label} className="py-0">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold tabular-nums mt-0.5">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Overall sentiment */}
      {data && totalMeetings > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Portfolio Sentiment</p>
                <div className="flex items-center gap-3">
                  <SentimentBar pos={totalPos} neu={totalNeu} neg={totalNeg} />
                  <span className="text-xs text-muted-foreground">
                    {totalPos} positive · {totalNeu} neutral · {totalNeg} negative
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {[
                  { label: `${Math.round((totalPos / totalMeetings) * 100)}% Positive`, color: "text-emerald-600 dark:text-emerald-400" },
                  { label: `${Math.round((totalNeg / totalMeetings) * 100)}% Negative`, color: "text-red-600 dark:text-red-400" },
                ].map(s => (
                  <span key={s.label} className={`text-sm font-semibold tabular-nums ${s.color}`}>{s.label}</span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-5">
        {/* Games with touchpoints */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Gamepad2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Games — Multi-Event Touchpoints</h2>
          </div>
          {isLoading && <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>}
          <div className="space-y-2.5" data-testid="games-touchpoints-list">
            {data?.gamesWithTouchpoints.map(game => {
              const sentiment = overallSentiment(game.sentiments);
              return (
                <Card key={game.id} data-testid={`game-card-${game.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold truncate">{game.title}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${egsStatusColors[game.currentEgsStatus]}`}>
                            {egsStatusLabels[game.currentEgsStatus]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <SentimentBadge sentiment={sentiment} size="sm" />
                          <span className="text-xs text-muted-foreground">
                            {game.touchpointCount} touch{game.touchpointCount !== 1 ? "points" : "point"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {game.events.map(ev => (
                            <Badge key={ev} variant="outline" className="text-xs">{ev}</Badge>
                          ))}
                        </div>
                        {game.notes && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{game.notes}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {data?.gamesWithTouchpoints.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Gamepad2 className="w-8 h-8 mx-auto mb-2 opacity-30" />No game data yet
              </div>
            )}
          </div>
        </div>

        {/* Platform topics */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Platform Topics — Aggregated Feedback</h2>
          </div>
          {isLoading && <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>}
          <div className="space-y-2.5" data-testid="platform-topics-list">
            {data?.topicsWithStats.map(topic => {
              const sentiment = overallSentiment(
                Array(topic.posCount).fill("positive").concat(
                  Array(topic.neutCount).fill("neutral"),
                  Array(topic.negCount).fill("negative")
                )
              );
              return (
                <Card key={topic.id} data-testid={`topic-card-${topic.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{topic.name}</span>
                          <span className={`text-xs font-medium capitalize ${categoryColors[topic.category]}`}>
                            {topic.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <SentimentBadge sentiment={sentiment} size="sm" />
                          <span className="text-xs text-muted-foreground">{topic.feedbackCount} feedback entries</span>
                        </div>
                        <div className="mt-2">
                          <SentimentBar pos={topic.posCount} neu={topic.neutCount} neg={topic.negCount} />
                        </div>
                        {topic.description && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{topic.description}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {data?.topicsWithStats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />No platform feedback yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recommended focus areas */}
      {data && (
        <Card className="mt-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />Recommended Focus Areas
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">BD — Top Opportunities</p>
                {data.gamesWithTouchpoints
                  .filter(g => g.currentEgsStatus !== "not_coming" && overallSentiment(g.sentiments) !== "negative")
                  .slice(0, 3)
                  .map(g => (
                    <div key={g.id} className="flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>{g.title}</span>
                    </div>
                  ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product — Top Blockers</p>
                {data.topicsWithStats
                  .filter(t => t.negCount > 0)
                  .sort((a, b) => b.negCount - a.negCount)
                  .slice(0, 3)
                  .map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      <span>{t.name}</span>
                    </div>
                  ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AM — Watch List</p>
                {data.gamesWithTouchpoints
                  .filter(g => g.currentEgsStatus === "not_coming" || overallSentiment(g.sentiments) === "negative")
                  .slice(0, 3)
                  .map(g => (
                    <div key={g.id} className="flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span>{g.title}</span>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
