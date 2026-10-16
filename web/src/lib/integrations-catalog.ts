// Every outside service FinOps can use, and the settings each one needs. A platform admin fills these in under
// Platform admin > Connections; they are stored (secrets encrypted) in the database and override the server's own settings.
// Each field's `env` is the name the rest of the code already reads, so nothing else has to change.

export type Field = {
  env: string;
  label: string;
  hint?: string;
  kind: "text" | "secret" | "select";
  options?: [value: string, label: string][];
  placeholder?: string;
  /** Needed for the connection to count as set up. */
  required?: boolean;
};

export type Integration = {
  id: string;
  label: string;
  about: string;
  /** Where to get the keys, shown as a link. */
  docs?: { label: string; href: string };
  fields: Field[];
  /** The connection can be tried with one click. */
  testable?: boolean;
  /** Changes only take effect after the server restarts. */
  restart?: boolean;
};

const KINDS = ["REMINDER", "ENTRY_GAVE", "ENTRY_GOT", "RECEIPT", "INVOICE", "QUOTE", "STATEMENT", "INVITE"];

export const INTEGRATIONS: Integration[] = [
  {
    id: "ai", label: "Reading photos of paper notes", testable: true,
    about: "An AI service that reads handwriting in a photo and turns it into lines. Pick any one provider below and add its key. Without one, the Paper notes page stays switched off.",
    docs: { label: "Get a Gemini key (has a free tier)", href: "https://aistudio.google.com/apikey" },
    fields: [
      { env: "NOTE_AI_PROVIDER", label: "Which service", kind: "select", options: [["", "Choose one…"], ["gemini", "Google Gemini"], ["anthropic", "Anthropic Claude"], ["openai", "OpenAI"], ["custom", "Another service (OpenAI-compatible)"]], hint: "Gemini has a free tier, which is a good place to start.", required: true },
      { env: "GEMINI_API_KEY", label: "Google Gemini key", kind: "secret", hint: "Needed when you choose Google Gemini." },
      { env: "ANTHROPIC_API_KEY", label: "Anthropic key", kind: "secret", hint: "Needed when you choose Anthropic Claude." },
      { env: "OPENAI_API_KEY", label: "OpenAI key", kind: "secret", hint: "Needed when you choose OpenAI." },
      { env: "NOTE_AI_BASE_URL", label: "Address of the other service", kind: "text", placeholder: "https://openrouter.ai/api/v1", hint: "Only for “Another service”. It must accept the OpenAI chat format with images (OpenRouter, Groq, Together, a local server…)." },
      { env: "NOTE_AI_API_KEY", label: "Key for the other service", kind: "secret", hint: "Only for “Another service”." },
      { env: "NOTE_AI_MODEL", label: "Model name", kind: "text", placeholder: "gemini-2.5-flash", hint: "Leave empty to use a sensible default. A model that can read images is needed." },
      { env: "NOTE_SCAN_FREE_PER_MONTH", label: "Pages each shop can read per month", kind: "text", placeholder: "30", hint: "Keeps the cost under control." },
    ],
  },
  {
    id: "google", label: "Sign in with Google", restart: false,
    about: "Lets people sign in with their Google account. The button appears on the sign-in page once both values are set.",
    docs: { label: "Google Cloud Console", href: "https://console.cloud.google.com/apis/credentials" },
    fields: [
      { env: "GOOGLE_CLIENT_ID", label: "Client ID", kind: "text", required: true },
      { env: "GOOGLE_CLIENT_SECRET", label: "Client secret", kind: "secret", required: true },
    ],
  },
  {
    id: "sms", label: "SMS and sign-in codes (MSG91)",
    about: "Sends sign-in codes and SMS reminders. In India each SMS template must be registered (DLT) first. Until this is connected, codes and messages are only recorded, not sent.",
    docs: { label: "MSG91", href: "https://msg91.com" },
    fields: [
      { env: "SMS_PROVIDER", label: "Mode", kind: "select", options: [["", "Test (nothing is sent)"], ["msg91", "MSG91"]], required: true },
      { env: "MSG91_AUTH_KEY", label: "Auth key", kind: "secret", required: true },
      { env: "MSG91_TEMPLATE_OTP", label: "Template ID for sign-in codes", kind: "text" },
      ...KINDS.map((k) => ({ env: `MSG91_TEMPLATE_${k}`, label: `Template ID: ${k.toLowerCase().replace("_", " ")}`, kind: "text" as const })),
    ],
  },
  {
    id: "email", label: "Email (Resend)",
    about: "Sends sign-in codes and bills by email. Until this is connected, emails are only recorded, not sent.",
    docs: { label: "Resend", href: "https://resend.com/api-keys" },
    fields: [
      { env: "EMAIL_PROVIDER", label: "Mode", kind: "select", options: [["", "Test (nothing is sent)"], ["resend", "Resend"]], required: true },
      { env: "RESEND_API_KEY", label: "API key", kind: "secret", required: true },
      { env: "EMAIL_FROM", label: "Send from", kind: "text", placeholder: "FinOps <hello@yourcompany.com>", required: true, hint: "An address on a domain you have verified with Resend." },
    ],
  },
  {
    id: "whatsapp", label: "WhatsApp Cloud API (optional)",
    about: "Sends WhatsApp messages by itself, using approved templates. You do not need this: reminders already open on the shop owner's own WhatsApp for them to send.",
    docs: { label: "Meta for Developers", href: "https://developers.facebook.com/docs/whatsapp/cloud-api" },
    fields: [
      { env: "WHATSAPP_PROVIDER", label: "Mode", kind: "select", options: [["", "Off (owners send from their own phone)"], ["meta", "WhatsApp Cloud API"]], required: true },
      { env: "WHATSAPP_TOKEN", label: "Access token", kind: "secret", required: true },
      { env: "WHATSAPP_PHONE_NUMBER_ID", label: "Phone number ID", kind: "text", required: true },
      { env: "WHATSAPP_TEMPLATE_PREFIX", label: "Template name prefix", kind: "text", placeholder: "finops_" },
      { env: "WHATSAPP_APP_SECRET", label: "App secret", kind: "secret", hint: "Used to check that incoming delivery updates really come from WhatsApp." },
      { env: "WHATSAPP_VERIFY_TOKEN", label: "Webhook verify token", kind: "secret" },
    ],
  },
  {
    id: "payments", label: "Online payments",
    about: "Lets shops add a “Pay online” link to bills. Until a gateway is connected it runs in test mode, where no money moves. Try the gateway in its sandbox before going live.",
    docs: { label: "Razorpay", href: "https://dashboard.razorpay.com/app/website-app-settings/api-keys" },
    fields: [
      { env: "PAYMENT_PROVIDER", label: "Gateway", kind: "select", options: [["", "Test mode only"], ["razorpay", "Razorpay"], ["cashfree", "Cashfree"]], required: true },
      { env: "PAYMENT_TEST_MODE", label: "Show test payments when no gateway is connected", kind: "select", options: [["", "No"], ["1", "Yes (no money moves)"]] },
      { env: "RAZORPAY_KEY_ID", label: "Razorpay key ID", kind: "text" },
      { env: "RAZORPAY_KEY_SECRET", label: "Razorpay key secret", kind: "secret" },
      { env: "RAZORPAY_WEBHOOK_SECRET", label: "Razorpay webhook secret", kind: "secret" },
      { env: "CASHFREE_APP_ID", label: "Cashfree app ID", kind: "text" },
      { env: "CASHFREE_SECRET", label: "Cashfree secret", kind: "secret" },
      { env: "CASHFREE_BASE_URL", label: "Cashfree address", kind: "text", placeholder: "https://sandbox.cashfree.com/pg" },
    ],
  },
  {
    id: "gstin", label: "GSTIN lookup",
    about: "Fills in a business's name, address and state when someone types a GSTIN. Without it, the lookup returns made-up details marked as a test.",
    docs: { label: "AppyFlow", href: "https://appyflow.in" },
    fields: [
      { env: "GSTIN_PROVIDER", label: "Service", kind: "select", options: [["", "Test (made-up details)"], ["appyflow", "AppyFlow"]], required: true },
      { env: "APPYFLOW_KEY", label: "AppyFlow key", kind: "secret", required: true },
    ],
  },
  {
    id: "security", label: "Scheduled jobs and backups",
    about: "Reminders and backups can be started by an outside timer that calls the app. The secret below is what proves the call is yours. The backup key encrypts backup files, so keep a copy of it somewhere safe: without it a backup cannot be opened.",
    fields: [
      { env: "CRON_SECRET", label: "Timer secret", kind: "secret", hint: "A long random text. Your timer sends it as “Authorization: Bearer …”." },
      { env: "BACKUP_KEY", label: "Backup encryption key", kind: "secret" },
    ],
  },
];

export const integrationById = (id: string) => INTEGRATIONS.find((i) => i.id === id);
export const allFields = () => INTEGRATIONS.flatMap((i) => i.fields);
export const fieldByEnv = (env: string) => allFields().find((f) => f.env === env);
