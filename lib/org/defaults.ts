// Defaults applied when a super admin provisions a new consultancy.

/** Modules enabled by default on a new org (the "Starter"-ish baseline). */
export const DEFAULT_MODULES = [
  'leads',
  'analytics',
  'email',
  'templates',
  'agents',
] as const;

/** The 5 seed email templates every new org starts with (mirrors seed.sql). */
export const DEFAULT_TEMPLATES = [
  {
    key: 'welcome',
    name: 'New Lead Welcome',
    subject: 'We received your application — {{full_name}}',
    body: 'Hi {{full_name}}, thank you for your interest in studying in {{target_country}}. Our team will review your details and reach out within 24 hours.',
    is_auto: true,
  },
  {
    key: 'acceptance',
    name: 'Acceptance',
    subject: 'Great news about your {{program}} application',
    body: 'Hi {{full_name}}, we are pleased to share an update on your application. Here are your next steps...',
    is_auto: false,
  },
  {
    key: 'rejection',
    name: 'Rejection (Compassionate)',
    subject: 'An update on your application',
    body: 'Hi {{full_name}}, thank you for trusting us. While this particular route did not work out, here are alternatives worth exploring...',
    is_auto: false,
  },
  {
    key: 'follow_up',
    name: 'Follow-Up',
    subject: 'Still here to help, {{full_name}}',
    body: 'Hi {{full_name}}, just checking in on your study-abroad plans. Reply any time and we will pick up where we left off.',
    is_auto: false,
  },
  {
    key: 'document_request',
    name: 'Document Request',
    subject: 'Documents needed to proceed',
    body: 'Hi {{full_name}}, to move your application forward we need the following documents...',
    is_auto: false,
  },
] as const;
