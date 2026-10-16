// The list of company details an admin can fill in (kept separate from the database code so the admin form can use it).
export type SiteKey = "company" | "address" | "supportEmail" | "privacyEmail" | "grievanceEmail" | "officerName" | "officerTitle" | "courtCity" | "replyDays" | "deleteDays";

export type SiteField = { key: SiteKey; label: string; hint: string; placeholder: string; kind: "text" | "email" | "number" | "textarea"; group: string; shownOn: string; default?: string };

export const SITE_FIELDS: SiteField[] = [
  { key: "company", group: "Your company", label: "Company name", hint: "The name exactly as it is on your company registration.", placeholder: "OneBridge Infotech Private Limited", kind: "text", shownOn: "Every legal page and the footer", default: "OneBridge Infotech" },
  { key: "address", group: "Your company", label: "Registered office address", hint: "Full postal address with PIN code.", placeholder: "Plot 12, Road No. 3, Jubilee Hills, Hyderabad 500033", kind: "textarea", shownOn: "Terms, Privacy and Contact pages" },
  { key: "courtCity", group: "Your company", label: "City for legal disputes", hint: "Usually the city of your registered office.", placeholder: "Hyderabad", kind: "text", shownOn: "Terms of Use" },
  { key: "supportEmail", group: "Email addresses people can write to", label: "Help and support email", hint: "A mailbox you check every working day.", placeholder: "support@yourcompany.com", kind: "email", shownOn: "Terms, Refunds, Acceptable Use and Contact pages" },
  { key: "privacyEmail", group: "Email addresses people can write to", label: "Privacy and data requests email", hint: "Where people ask to see, correct or delete their data.", placeholder: "privacy@yourcompany.com", kind: "email", shownOn: "Privacy Policy and Contact pages" },
  { key: "grievanceEmail", group: "Email addresses people can write to", label: "Complaints email", hint: "Where the Grievance Officer receives complaints.", placeholder: "grievance@yourcompany.com", kind: "email", shownOn: "Terms and Contact pages" },
  { key: "officerName", group: "Grievance Officer", label: "Officer’s full name", hint: "Indian law asks every online service to name one person who handles complaints.", placeholder: "Anita Sharma", kind: "text", shownOn: "Contact & Grievance page" },
  { key: "officerTitle", group: "Grievance Officer", label: "Officer’s designation", hint: "Their job title in your company.", placeholder: "Head of Customer Support", kind: "text", shownOn: "Contact & Grievance page" },
  { key: "replyDays", group: "Promises to customers", label: "We reply to complaints within (days)", hint: "How quickly you promise to answer. 15 is common.", placeholder: "15", kind: "number", shownOn: "Privacy, Refunds and Contact pages", default: "15" },
  { key: "deleteDays", group: "Promises to customers", label: "We delete a closed shop’s data within (days)", hint: "How long you take to erase a shop after someone asks.", placeholder: "30", kind: "number", shownOn: "Privacy and Contact pages", default: "30" },
];

