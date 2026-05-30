import { FormEvent, useState } from "react";
import { z } from "zod";
import { DocPageLayout, DocSection } from "@/components/DocPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Schema mirrors server-side validation. Keeps inputs bounded.
const contactSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(120),
  email: z.string().trim().email("Please enter a valid email").max(255),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Please write at least 10 characters").max(4000),
});

export default function Contact() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      subject: String(fd.get("subject") ?? ""),
      message: String(fd.get("message") ?? ""),
      // Honeypot — bots tend to fill every field
      website: String(fd.get("website") ?? ""),
    };

    if (raw.website) {
      // Silently accept — looks successful to bots
      setSent(true);
      return;
    }

    const parsed = contactSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0]?.toString();
        if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const id = crypto.randomUUID();
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "contact-form-inquiry",
          // Recipient is hard-coded server-side via the template/registry —
          // we forward the address here, but it never appears in the page source
          // for visitors. The actual operator email lives in the edge function call below.
          recipientEmail: "alexander.anton-boicuk@study.hs-duesseldorf.de",
          idempotencyKey: `contact-${id}`,
          templateData: {
            name: parsed.data.name,
            email: parsed.data.email,
            subject: parsed.data.subject || undefined,
            message: parsed.data.message,
            submittedAt: new Date().toUTCString(),
          },
        },
      });
      if (error) throw error;
      setSent(true);
      toast({
        title: "Message sent",
        description: "Thanks — your message has been delivered.",
      });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      console.error(err);
      toast({
        title: "Could not send message",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DocPageLayout
      eyebrow="Contact"
      title="Get in touch"
      intro="Questions, corrections, data leads, or collaboration ideas — send a message and we'll get back to you."
    >
      <DocSection num="01" title="Contact form">
        {sent ? (
          <div className="rounded-sm border border-border bg-secondary p-6">
            <p className="text-sm">
              Thanks for reaching out. Your message has been sent.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-xl" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={120} autoComplete="name" />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required maxLength={255} autoComplete="email" />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="subject">Subject (optional)</Label>
              <Input id="subject" name="subject" maxLength={200} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" name="message" required rows={6} maxLength={4000} />
              {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
            </div>

            {/* Honeypot field — hidden from real users, visible to dumb bots */}
            <div className="hidden" aria-hidden="true">
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            <div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Send message"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Your message is sent directly to the project team. We never publish your
              email address.
            </p>
          </form>
        )}
      </DocSection>
    </DocPageLayout>
  );
}
