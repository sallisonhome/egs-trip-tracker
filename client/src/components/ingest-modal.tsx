import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FileText, Link2, Upload, AlignLeft } from "lucide-react";

interface IngestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  eventName: string;
}

export function IngestModal({ open, onOpenChange, eventId, eventName }: IngestModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pastedText, setPastedText] = useState("");
  const [googleDocUrl, setGoogleDocUrl] = useState("");
  const [fileName, setFileName] = useState("");

  const ingest = useMutation({
    mutationFn: async (payload: {
      sourceType: string;
      rawText?: string;
      externalUrl?: string;
      originalFileName?: string;
      rawTextExcerpt?: string;
    }) => {
      return apiRequest("POST", "/api/source-documents", {
        eventId,
        ...payload,
        uploadedByUserId: 1, // stub: real app would use auth context
        parsingStatus: "pending",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events", eventId, "source-documents"] });
      qc.invalidateQueries({ queryKey: ["/api/events", eventId] });
      toast({ title: "Report ingested", description: "Source document processed successfully." });
      onOpenChange(false);
      setPastedText("");
      setGoogleDocUrl("");
      setFileName("");
    },
    onError: () => {
      toast({ title: "Ingest failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) return;
    ingest.mutate({
      sourceType: "pasted_text",
      rawText: pastedText,
      rawTextExcerpt: pastedText.slice(0, 300),
    });
  };

  const handleGoogleDocSubmit = () => {
    if (!googleDocUrl.trim()) return;
    ingest.mutate({
      sourceType: "google_doc",
      externalUrl: googleDocUrl,
      rawTextExcerpt: `Google Doc: ${googleDocUrl}`,
    });
  };

  const handleFileUpload = (sourceType: "pdf_file" | "word_file") => {
    if (!fileName.trim()) return;
    ingest.mutate({
      sourceType,
      originalFileName: fileName,
      rawTextExcerpt: `Uploaded file: ${fileName}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" data-testid="modal-ingest">
        <DialogHeader>
          <DialogTitle>Ingest Report</DialogTitle>
          <DialogDescription>
            Add a trip or event report to <strong>{eventName}</strong>. Choose how you want to submit.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="paste" className="mt-2">
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

          <TabsContent value="paste" className="space-y-3 mt-3">
            <Label htmlFor="paste-text">Paste report text</Label>
            <Textarea
              id="paste-text"
              data-testid="input-paste-text"
              placeholder="Paste your trip report, meeting notes, or email here..."
              className="min-h-[200px] font-mono text-sm"
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The system will auto-detect meeting sections, games, and platform topics.
            </p>
            <Button
              onClick={handlePasteSubmit}
              disabled={!pastedText.trim() || ingest.isPending}
              data-testid="button-submit-paste"
              className="w-full"
            >
              {ingest.isPending ? "Processing..." : "Ingest Pasted Text"}
            </Button>
          </TabsContent>

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
              Make sure the document is shared with "Anyone with link can view" access.
            </p>
            <Button
              onClick={handleGoogleDocSubmit}
              disabled={!googleDocUrl.trim() || ingest.isPending}
              data-testid="button-submit-google"
              className="w-full"
            >
              {ingest.isPending ? "Processing..." : "Link Google Doc"}
            </Button>
          </TabsContent>

          <TabsContent value="pdf" className="space-y-3 mt-3">
            <Label htmlFor="pdf-filename">PDF File Name (stub)</Label>
            <Input
              id="pdf-filename"
              data-testid="input-pdf-filename"
              placeholder="GDC-2026-Trip-Report.pdf"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
            />
            <div className="border-2 border-dashed rounded-md p-6 text-center text-muted-foreground text-sm">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              File upload UI — connect to storage backend in production
            </div>
            <Button
              onClick={() => handleFileUpload("pdf_file")}
              disabled={!fileName.trim() || ingest.isPending}
              data-testid="button-submit-pdf"
              className="w-full"
            >
              {ingest.isPending ? "Processing..." : "Upload PDF"}
            </Button>
          </TabsContent>

          <TabsContent value="word" className="space-y-3 mt-3">
            <Label htmlFor="word-filename">Word File Name (stub)</Label>
            <Input
              id="word-filename"
              data-testid="input-word-filename"
              placeholder="Gamescom-Notes.docx"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
            />
            <div className="border-2 border-dashed rounded-md p-6 text-center text-muted-foreground text-sm">
              <Upload className="w-8 h-8 mx-auto mb-2 opacity-40" />
              File upload UI — connect to storage backend in production
            </div>
            <Button
              onClick={() => handleFileUpload("word_file")}
              disabled={!fileName.trim() || ingest.isPending}
              data-testid="button-submit-word"
              className="w-full"
            >
              {ingest.isPending ? "Processing..." : "Upload Word Doc"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
