import { useQuery } from "@tanstack/react-query";
import type { SourceDocument } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Link2, Upload, AlignLeft, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const sourceTypeConfig = {
  pasted_text: { label: "Pasted Text", icon: AlignLeft, color: "text-blue-500" },
  google_doc: { label: "Google Doc", icon: Link2, color: "text-green-500" },
  pdf_file: { label: "PDF", icon: FileText, color: "text-red-500" },
  word_file: { label: "Word Doc", icon: Upload, color: "text-blue-600" },
  other: { label: "Other", icon: FileText, color: "text-muted-foreground" },
};

const parsingStatusConfig = {
  pending: { label: "Pending", icon: Clock, classes: "bg-muted text-muted-foreground" },
  success: { label: "Parsed", icon: CheckCircle2, classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  failed: { label: "Failed", icon: XCircle, classes: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  partially_parsed: { label: "Partial", icon: AlertCircle, classes: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
};

interface SourceDocumentsPanelProps {
  eventId: number;
  onIngestClick?: () => void;
}

export function SourceDocumentsPanel({ eventId, onIngestClick }: SourceDocumentsPanelProps) {
  const { data: docs, isLoading } = useQuery<SourceDocument[]>({
    queryKey: ["/api/events", eventId, "source-documents"],
    queryFn: async () => {
      const r = await fetch(`/api/events/${eventId}/source-documents`);
      return r.json();
    },
  });

  return (
    <Card data-testid="panel-source-documents">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Source Documents
          </span>
          {docs && <Badge variant="secondary" className="text-xs">{docs.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
        {docs?.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">No source documents yet. Use "Ingest Report" to add one.</p>
        )}
        {docs?.map(doc => {
          const stc = sourceTypeConfig[doc.sourceType] ?? sourceTypeConfig.other;
          const psc = parsingStatusConfig[doc.parsingStatus];
          const Icon = stc.icon;
          const StatusIcon = psc.icon;
          return (
            <div key={doc.id} className="flex items-start gap-3 p-2.5 rounded-md bg-muted/40" data-testid={`doc-item-${doc.id}`}>
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${stc.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium truncate">
                    {doc.originalFileName ?? doc.externalUrl?.slice(0, 40) ?? stc.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${psc.classes}`}>
                    <StatusIcon className="w-3 h-3" />
                    {psc.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stc.label} · {format(new Date(doc.uploadedAt), "MMM d, yyyy")}
                </p>
                {doc.rawTextExcerpt && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono leading-tight">
                    {doc.rawTextExcerpt}
                  </p>
                )}
                {doc.parsingLog && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">{doc.parsingLog}</p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
