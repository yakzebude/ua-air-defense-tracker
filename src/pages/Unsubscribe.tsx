import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DocPageLayout, DocSection } from "@/components/DocPageLayout";
import { Button } from "@/components/ui/button";

type Status = "loading" | "valid" | "already" | "invalid" | "confirming" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const validate = async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey, Authorization: `Bearer ${apikey}` } },
        );
        const data = await res.json();
        if (res.ok && data.valid) setStatus("valid");
        else if (data?.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      } catch {
        setStatus("error");
      }
    };
    validate();
  }, [token, supabaseUrl, apikey]);

  const confirm = async () => {
    if (!token) return;
    setStatus("confirming");
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey,
          Authorization: `Bearer ${apikey}`,
        },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.reason === "already_unsubscribed")) setStatus("done");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <DocPageLayout eyebrow="Email" title="Unsubscribe" intro="Manage your email preferences for this site.">
      <DocSection num="01" title="Confirm unsubscribe">
        {status === "loading" && <p className="text-sm text-muted-foreground">Checking your link…</p>}
        {status === "invalid" && (
          <p className="text-sm">This unsubscribe link is invalid or has expired.</p>
        )}
        {status === "already" && (
          <p className="text-sm">You are already unsubscribed. No further emails will be sent.</p>
        )}
        {status === "valid" && (
          <div className="space-y-4">
            <p className="text-sm">
              Click the button below to confirm and stop receiving emails from this site.
            </p>
            <Button onClick={confirm}>Confirm unsubscribe</Button>
          </div>
        )}
        {status === "confirming" && <p className="text-sm text-muted-foreground">Processing…</p>}
        {status === "done" && (
          <p className="text-sm">You have been unsubscribed. We won't email you again.</p>
        )}
        {status === "error" && (
          <p className="text-sm text-destructive">Something went wrong. Please try the link again later.</p>
        )}
      </DocSection>
    </DocPageLayout>
  );
}
