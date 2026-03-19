import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Link2, Upload, AlignLeft, X, CheckCircle2 } from "lucide-react";
import type { EventWithStats } from "@shared/schema";

interface IngestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // If provided, locks the modal to this event. If null, shows an event selector.
  eventId?: number | null;
  eventName?: string;
}

function FileDropZone({
  accept,
  label,
  icon: Icon,
  onFile,
  file,
  loading,
}: {
  accept: string;
  label: string;
  icon: React.ElementType;
  onFile: (f: File) => void;
  file: File | null;
  loading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
        ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}
        ${file ? "border-emerald-500/50 bg-emerald-500/5" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      {file ? (
        <div className="flex flex-col items-center gap-1">
          <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 truncate max-w-xs">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB — click to replace</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Icon className="w-8 h-8 opacity-30" />
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">Drag & drop or click to browse</p>
        </div>
      )}
    </div>
  );
}

export function IngestModal({ open, onOpenChange, eventId: lockedEventId, eventName }: IngestModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Event selector (when not locked to a specific event)
  const { data: events } = useQuery<EventWithStats[]>({ queryKey: ["/api/events"] });
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const resolvedEventId = lockedEventId ?? (selectedEventId ? parseInt(selectedEventId) : null);
  const resolvedEventName = eventName ?? events?.find(e => e.id === resolvedEventId)?.name ?? "";

  // Tab state
  const [pastedText, setPastedText] = useState("");
  const [googleDocUrl, setGoogleDocUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const reset = () => {
    setPastedText("");
    setGoogleDocUrl("");
    setPdfFile(null);
    setWordFile(null);
    setSelectedEventId("");
    setIsProcessing(false);
  };

  const ingest = useMutation({
    mutationFn: async (payload: {
      sourceType: string;
      rawText?: string;
      externalUrl?: string;
      originalFileName?: string;
      rawTextExcerpt?: string;
    }) => {
      if (!resolvedEventId) throw new Error("No event selected");
      return apiRequest("POST", "/api/source-documents", {
        eventId: resolvedEventId,
        ...payload,
        uploadedByUserId: 1,
        parsingStatus: "success",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      if (resolvedEventId) {
        qc.invalidateQueries({ queryKey: [`/api/events/${resolvedEventId}/source-documents`] });
      }
      toast({ title: "Report ingested", description: `Added to ${resolvedEventName}.` });
      onOpenChange(false);
      reset();
    },
    onError: (err: any) => {
      toast({
        title: "Ingest failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  const handlePasteSubmit = () => {
    if (!pastedText.trim() || !resolvedEventId) return;
    ingest.mutate({
      sourceType: "pasted_text",
      rawText: pastedText,
      rawTextExcerpt: pastedText.slice(0, 400),
    });
  };

  const handleGoogleDocSubmit = () => {
    if (!googleDocUrl.trim() || !resolvedEventId) return;
    ingest.mutate({
      sourceType: "google_doc",
      externalUrl: googleDocUrl,
      rawTextExcerpt: `Google Doc: ${googleDocUrl}`,
    });
  };

  const handleFileSubmit = async (file: File, sourceType: "pdf_file" | "word_file") => {
    if (!file || !resolvedEventId) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventId", String(resolvedEventId));
      formData.append("uploadedByUserId", "1");

      const res = await fetch(`${import.meta.env.VITE_API_BASE ?? ""}/api/upload-document`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? "Upload failed");
      }

      const doc = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      if (resolvedEventId) {
        qc.invalidateQueries({ queryKey: [`/api/events/${resolvedEventId}/source-documents`] });
      }

      const charInfo = doc.characterCount > 0
        ? ` Extracted ${doc.characterCount.toLocaleString()} characters.`
        : " File stored — no text extracted.";

      toast({
        title: "Report uploaded",
        description: `${file.name} added to ${resolvedEventName}.${charInfo}`,
      });
      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const isLoading = ingest.isPending || isProcessing;
  const noEvent = !resolvedEventId;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-xl" data-testid="modal-ingest">
        <DialogHeader>
          <DialogTitle>Upload Trip Report</DialogTitle>
          <DialogDescription>
            {lockedEventId
              ? <>Add a report to <strong>{eventName}</strong>.</>
              : "Select an event, then submit your trip report in any format."}
          </DialogDescription>
        </DialogHeader>

        {/* Event selector — shown when not locked to a specific event */}
        {!lockedEventId && (
          <div className="space-y-1.5">
            <Label>Event</Label>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger data-testid="select-ingest-event">
                <SelectValue placeholder="Select an event..." />
              </SelectTrigger>
              <SelectContent>
                {(events ?? []).map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Tabs defaultValue="paste" className="mt-1">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="paste" data-testid="tab-paste">
              <AlignLeft className="w-3.5 h-3.5 mr-1" />Paste
            </TabsTrigger>
            <TabsTrigger value="google" data-testid="tab-google">
              <Link2 className="w-3.5 h-3.5 mr-1" />Google Doc
            </TabsTrigger>
            <TabsTrigger value="pdf" data-testid="tab-pdf">
              <FileText className="w-3.5 h-3.5 mr-1" />PDF
            </TabsTrigger>
            <TabsTrigger value="word" data-testid="tab-word">
              <Upload className="w-3.5 h-3.5 mr-1" />Word
            </TabsTrigger>
          </TabsList>

          {/* ── Paste ── */}
          <TabsContent value="paste" className="space-y-3 mt-3">
            <Textarea
              id="paste-text"
              data-testid="input-paste-text"
              placeholder="Paste your trip report, meeting notes, or email thread here..."
              className="min-h-[180px] font-mono text-sm"
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Supports any free-form text — the system logs it as a source document for this event.
            </p>
            <Button
              onClick={handlePasteSubmit}
              disabled={!pastedText.trim() || isLoading || noEvent}
              data-testid="button-submit-paste"
              className="w-full"
            >
              {isLoading ? "Saving..." : "Save Pasted Report"}
            </Button>
          </TabsContent>

          {/* ── Google Doc ── */}
          <TabsContent value="google" className="space-y-3 mt-3">
            <Label htmlFor="google-url">Google Docs URL</Label>
            <Input
              id="google-url"
              data-testid="input-google-url"
              placeholder="https://docs.google.com/document/d/..."
              value={googleDocUrl}
              onChange={e => setGoogleDocUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Make sure the document is shared as <strong>Anyone with the link can view</strong>.
            </p>
            <Button
              onClick={handleGoogleDocSubmit}
              disabled={!googleDocUrl.trim() || isLoading || noEvent}
              data-testid="button-submit-google"
              className="w-full"
            >
              {isLoading ? "Saving..." : "Link Google Doc"}
            </Button>
          </TabsContent>

          {/* ── PDF ── */}
          <TabsContent value="pdf" className="space-y-3 mt-3">
            <FileDropZone
              accept=".pdf,.txt,.md"
              label="Drop PDF or text file here"
              icon={FileText}
              onFile={setPdfFile}
              file={pdfFile}
              loading={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Supported: .pdf, .txt, .md — file metadata and readable text are stored.
            </p>
            <Button
              onClick={() => pdfFile && handleFileSubmit(pdfFile, "pdf_file")}
              disabled={!pdfFile || isLoading || noEvent}
              data-testid="button-submit-pdf"
              className="w-full"
            >
              {isLoading ? "Uploading..." : "Upload PDF"}
            </Button>
          </TabsContent>

          {/* ── Word ── */}
          <TabsContent value="word" className="space-y-3 mt-3">
            <FileDropZone
              accept=".docx,.doc,.txt,.md"
              label="Drop Word doc or text file here"
              icon={Upload}
              onFile={setWordFile}
              file={wordFile}
              loading={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Supported: .docx, .doc, .txt, .md — file metadata and readable text are stored.
            </p>
            <Button
              onClick={() => wordFile && handleFileSubmit(wordFile, "word_file")}
              disabled={!wordFile || isLoading || noEvent}
              data-testid="button-submit-word"
              className="w-full"
            >
              {isLoading ? "Uploading..." : "Upload Word Doc"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
