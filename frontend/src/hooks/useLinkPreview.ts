import { useEffect, useMemo, useRef, useState } from "react";
import { extractFirstUrl } from "@/lib/detectUrls";
import { linkPreviewApi } from "@/services/linkPreviewApiService";
import type { LinkPreview } from "@/types";

export function useLinkPreview(text: string, enabled = true) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const dismissedUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const url = useMemo(() => extractFirstUrl(text), [text]);

  useEffect(() => {
    if (!enabled || !url) {
      setPreview(null);
      setLoading(false);
      return;
    }

    if (dismissed && dismissedUrlRef.current === url) {
      setPreview(null);
      setLoading(false);
      return;
    }

    if (dismissedUrlRef.current !== url) {
      setDismissed(false);
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);

    const timer = window.setTimeout(() => {
      void linkPreviewApi
        .fetch(url)
        .then((result) => {
          if (requestIdRef.current !== requestId) return;
          setPreview(result);
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return;
          setPreview(null);
        })
        .finally(() => {
          if (requestIdRef.current !== requestId) return;
          setLoading(false);
        });
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, url, dismissed]);

  const dismiss = () => {
    dismissedUrlRef.current = url;
    setDismissed(true);
    setPreview(null);
  };

  return {
    url,
    preview: dismissed ? null : preview,
    loading: enabled && Boolean(url) && loading && !dismissed,
    dismiss,
    isDismissed: dismissed && Boolean(url),
  };
}

export function useMessageLinkPreview(message: {
  content: string;
  linkPreview?: LinkPreview;
  linkPreviewSuppressed?: boolean;
}) {
  return {
    preview: message.linkPreviewSuppressed ? null : (message.linkPreview ?? null),
    loading: false,
  };
}
