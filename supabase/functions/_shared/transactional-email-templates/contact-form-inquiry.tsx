/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'UA Air Defense Tracker'

interface ContactFormInquiryProps {
  name?: string
  email?: string
  subject?: string
  message?: string
  submittedAt?: string
}

const ContactFormInquiryEmail = ({
  name,
  email,
  subject,
  message,
  submittedAt,
}: ContactFormInquiryProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New contact inquiry from {name || 'a website visitor'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New contact inquiry</Heading>
        <Text style={lead}>
          Someone reached out via the {SITE_NAME} contact form.
        </Text>

        <Section style={card}>
          <Text style={label}>Name</Text>
          <Text style={value}>{name || '—'}</Text>

          <Hr style={divider} />

          <Text style={label}>Email</Text>
          <Text style={value}>{email || '—'}</Text>

          {subject ? (
            <>
              <Hr style={divider} />
              <Text style={label}>Subject</Text>
              <Text style={value}>{subject}</Text>
            </>
          ) : null}

          <Hr style={divider} />

          <Text style={label}>Message</Text>
          <Text style={messageText}>{message || '—'}</Text>

          {submittedAt ? (
            <>
              <Hr style={divider} />
              <Text style={label}>Submitted</Text>
              <Text style={value}>{submittedAt}</Text>
            </>
          ) : null}
        </Section>

        <Text style={footer}>
          Reply directly to this email to respond to the sender.
        </Text>
      </Container>
    </Body>
  </Html>
)

// Fixed operator recipient — prevents caller-controlled `recipientEmail` from
// being used as an open relay. Configure via the EMAIL_CONTACT_RECIPIENT secret.
const CONTACT_RECIPIENT =
  (typeof Deno !== 'undefined' && Deno.env.get('EMAIL_CONTACT_RECIPIENT')) ||
  'contact@ua-airdefense-tracker.org'

export const template = {
  component: ContactFormInquiryEmail,
  subject: (data: Record<string, any>) =>
    data?.subject
      ? `[Contact] ${data.subject}`
      : `[Contact] New inquiry from ${data?.name || 'website visitor'}`,
  to: CONTACT_RECIPIENT,
  displayName: 'Contact form inquiry',
  previewData: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    subject: 'Question about the data',
    message: 'Hi, could you explain how the interception rate is calculated?',
    submittedAt: new Date().toISOString(),
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: 0,
  padding: 0,
}
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = {
  fontSize: '22px',
  fontWeight: 600,
  color: '#0a0a0a',
  margin: '0 0 8px',
  letterSpacing: '-0.01em',
}
const lead = { fontSize: '14px', color: '#55575d', margin: '0 0 24px' }
const card = {
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '20px',
  backgroundColor: '#fafafa',
}
const label = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
  color: '#6b7280',
  margin: '0 0 4px',
  fontWeight: 600,
}
const value = { fontSize: '14px', color: '#0a0a0a', margin: '0' }
const messageText = {
  fontSize: '14px',
  color: '#0a0a0a',
  margin: '0',
  whiteSpace: 'pre-wrap' as const,
  lineHeight: '1.6',
}
const divider = { borderColor: '#e5e7eb', margin: '14px 0' }
const footer = {
  fontSize: '12px',
  color: '#9ca3af',
  margin: '24px 0 0',
  textAlign: 'center' as const,
}
