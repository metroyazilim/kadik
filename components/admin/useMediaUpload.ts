"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaAssetDto } from "@/lib/media/types";
import { toWebpFile } from "@/lib/media/webp-client";
import { finalizeMediaUploadAction, requestMediaUploadTicketAction } from "@/app/manage/(panel)/media/actions";

export type MediaUploadState =
  | { status: "idle" }
  | { status: "uploading"; fileName: string; progress: number }
  | { status: "finalizing"; fileName: string }
  | { status: "error"; fileName: string; message: string };

/**
 * Shared client-side upload pipeline for `MediaPickerModal` and the media
 * library's own upload flow (one implementation, not two, per AD-9). A file
 * never passes through a server action's buffered body: `start` requests a
 * presigned ticket, `PUT`s the bytes straight to storage over `XHR` (the
 * only browser upload API that reports `upload.onprogress`), then finalizes
 * - the server downloads the object back and runs the real magic-byte
 * validation before any `MediaAsset` row exists (AC-4.1-02/03 still hold
 * for a direct upload, not just a buffered one).
 *
 * `cancel` aborts the in-flight `PUT`; the ticket's `MediaUploadAttempt` row
 * is simply left unresolved and reaped later by `cleanupOrphanMediaUploads`
 * - no separate cancellation cleanup path to get wrong. `retry` re-runs the
 * same file from a fresh ticket (the previous one may have expired).
 */
export function useMediaUpload(onDone: (asset: MediaAssetDto) => void) {
  const [state, setState] = useState<MediaUploadState>({ status: "idle" });
  const pendingRef = useRef<{ file: File; altText?: string; caption?: string } | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  async function run(original: File, meta?: { altText?: string; caption?: string }) {
    pendingRef.current = { file: original, ...meta };
    setState({ status: "uploading", fileName: original.name, progress: 0 });

    // Normalized before the ticket is requested so the presigned object key,
    // the declared mime type and the finalize-time magic-byte check all
    // describe the bytes actually stored.
    const file = await toWebpFile(original);

    const ticketResult = await requestMediaUploadTicketAction({
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      byteSize: file.size,
    });
    if (!ticketResult.success) {
      setState({ status: "error", fileName: file.name, message: ticketResult.error });
      return;
    }
    const ticket = ticketResult.data;

    const putOutcome = await new Promise<"done" | "aborted" | string>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open(ticket.method, ticket.uploadUrl, true);
      for (const [key, value] of Object.entries(ticket.headers)) {
        xhr.setRequestHeader(key, value);
      }
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setState({ status: "uploading", fileName: file.name, progress: Math.round((event.loaded / event.total) * 100) });
        }
      };
      xhr.onerror = () => resolve("Depolamaya bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
      xhr.onabort = () => resolve("aborted");
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve("done");
        } else {
          resolve(`Depolamaya yazma başarısız oldu (HTTP ${xhr.status}).`);
        }
      };
      xhr.send(file);
    });
    xhrRef.current = null;

    if (putOutcome === "aborted") {
      setState({ status: "idle" });
      return;
    }
    if (putOutcome !== "done") {
      setState({ status: "error", fileName: file.name, message: putOutcome });
      return;
    }

    setState({ status: "finalizing", fileName: file.name });
    const finalizeResult = await finalizeMediaUploadAction({
      objectKey: ticket.objectKey,
      originalFilename: file.name,
      altText: meta?.altText,
      caption: meta?.caption,
    });
    if (!finalizeResult.success) {
      setState({ status: "error", fileName: file.name, message: finalizeResult.error });
      return;
    }
    setState({ status: "idle" });
    onDoneRef.current(finalizeResult.data);
  }

  return {
    state,
    start(file: File, meta?: { altText?: string; caption?: string }) {
      void run(file, meta);
    },
    cancel() {
      xhrRef.current?.abort();
    },
    retry() {
      if (pendingRef.current) void run(pendingRef.current.file, pendingRef.current);
    },
    dismissError() {
      setState({ status: "idle" });
    },
  };
}
