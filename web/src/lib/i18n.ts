// App language (LO-01). Pure, so both server and client components use it.
// Translations cover the everyday screens (home, parties, ledger, entries,
// collections, follow-ups, navigation). Anything missing falls back to English.
// They were written without native-speaker review; have them checked before launch.

export const UI_LANGUAGES = { en: "English", hi: "हिन्दी", te: "తెలుగు", ta: "தமிழ்", kn: "ಕನ್ನಡ" } as const;
export type UiLang = keyof typeof UI_LANGUAGES;

const en = {
  "nav.home": "Home", "nav.more": "More", "nav.parties": "Parties", "nav.invoices": "Invoices", "nav.collect": "Collect", "nav.followups": "Follow-ups",
  "nav.items": "Items", "nav.settings": "Settings", "nav.search": "Search", "nav.signout": "Sign out",
  "dash.today": "Today", "dash.addParty": "Add party", "dash.newInvoice": "New invoice",
  "dash.toCollect": "To collect", "dash.overdue": "Overdue", "dash.toPay": "To pay", "dash.collectedToday": "Collected today",
  "dash.creditToday": "Credit given today", "dash.cashToday": "Cash in today", "dash.followUpsDue": "Follow-ups due",
  "dash.topOverdue": "Top overdue", "dash.recent": "Recent activity", "dash.team": "Team activity today",
  "dash.nothingOverdue": "Nothing overdue", "dash.allWithin": "All dues are within their credit period.",
  "dash.firstCustomer": "Add your first customer to start tracking credit.", "dash.noEntries": "No entries yet",
  "dash.ofDue": "of {amount} due", "dash.customize": "Customise", "dash.quotesOpen": "Open quotations",
  "bal.toCollect": "to collect", "bal.toPay": "to pay", "bal.settled": "Settled",
  "parties.title": "Parties", "parties.search": "Search by name, phone or GSTIN", "parties.import": "Import",
  "parties.all": "All", "parties.customers": "Customers", "parties.suppliers": "Suppliers", "parties.leads": "Leads", "parties.archived": "Archived",
  "parties.none": "No parties yet", "parties.noMatch": "No parties match your search", "parties.total": "{n} total",
  "type.CUSTOMER": "Customer", "type.SUPPLIER": "Supplier", "type.BOTH": "Customer & supplier", "type.LEAD": "Lead",
  "party.balance": "Balance", "party.overdue": "Overdue", "party.entries": "Entries", "party.noEntries": "No entries yet.",
  "party.edit": "Edit", "party.copyStatement": "Copy statement link", "party.remind": "Send WhatsApp reminder",
  "party.newInvoice": "New invoice", "party.newQuote": "New quotation", "party.followUps": "Follow-ups", "party.messages": "Messages",
  "party.invoices": "Invoices", "party.history": "Message history", "party.makeCustomer": "Convert to customer", "party.invite": "Invite to the app",
  "col.date": "Date", "col.details": "Details", "col.gave": "You gave", "col.got": "You got", "col.balance": "Balance",
  "entry.gave": "You gave (credit / goods)", "entry.got": "You got (payment)", "entry.amount": "Amount (₹)", "entry.date": "Date",
  "entry.due": "Due date", "entry.paidBy": "Paid by", "entry.note": "Note", "entry.save": "Save entry", "entry.saving": "Saving…",
  "entry.notify": "Send this entry to the party", "entry.receipt": "A receipt will be sent to the party automatically.",
  "entry.notPayment": "Not a payment (goods received)", "entry.reverse": "Reverse", "entry.attach": "Attach bill / photo / PDF",
  "entry.voice": "Voice note", "entry.stop": "Stop recording",
  "collect.title": "Collections", "collect.sub": "Who to follow up with, and reminders in bulk", "collect.overdue": "Overdue",
  "collect.today": "Due today", "collect.week": "Next 7 days", "collect.all": "All dues", "collect.daysOverdue": "{range} days overdue",
  "fu.title": "Follow-ups", "fu.due": "Overdue & today", "fu.upcoming": "Upcoming", "fu.done": "Done", "fu.mine": "Mine", "fu.everyone": "Everyone",
  "fu.add": "Add follow-up", "fu.about": "Follow up about", "fu.markDone": "Mark done", "fu.call": "Call",
};

export type UiKey = keyof typeof en;
type Dict = Partial<Record<UiKey, string>>;

const hi: Dict = {
  "nav.home": "होम", "nav.more": "और", "nav.parties": "पार्टियाँ", "nav.invoices": "बिल", "nav.collect": "वसूली", "nav.followups": "फ़ॉलो-अप",
  "nav.items": "सामान", "nav.settings": "सेटिंग्स", "nav.search": "खोजें", "nav.signout": "साइन आउट",
  "dash.today": "आज", "dash.addParty": "पार्टी जोड़ें", "dash.newInvoice": "नया बिल",
  "dash.toCollect": "लेना है", "dash.overdue": "बकाया (समय निकला)", "dash.toPay": "देना है", "dash.collectedToday": "आज की वसूली",
  "dash.creditToday": "आज दिया उधार", "dash.cashToday": "आज नकद आया", "dash.followUpsDue": "बाकी फ़ॉलो-अप",
  "dash.topOverdue": "सबसे ज़्यादा बकाया", "dash.recent": "हाल की एंट्री", "dash.team": "आज टीम का काम",
  "dash.nothingOverdue": "कुछ भी बकाया नहीं", "dash.allWithin": "सारे बकाया उधार अवधि के अंदर हैं।",
  "dash.firstCustomer": "उधार का हिसाब रखने के लिए पहला ग्राहक जोड़ें।", "dash.noEntries": "अभी कोई एंट्री नहीं",
  "dash.ofDue": "{amount} में से", "dash.customize": "बदलें", "dash.quotesOpen": "खुले कोटेशन",
  "bal.toCollect": "लेना है", "bal.toPay": "देना है", "bal.settled": "हिसाब बराबर",
  "parties.title": "पार्टियाँ", "parties.search": "नाम, फ़ोन या GSTIN से खोजें", "parties.import": "इम्पोर्ट",
  "parties.all": "सभी", "parties.customers": "ग्राहक", "parties.suppliers": "सप्लायर", "parties.leads": "संभावित ग्राहक", "parties.archived": "संग्रहित",
  "parties.none": "अभी कोई पार्टी नहीं", "parties.noMatch": "कोई पार्टी नहीं मिली", "parties.total": "कुल {n}",
  "type.CUSTOMER": "ग्राहक", "type.SUPPLIER": "सप्लायर", "type.BOTH": "ग्राहक व सप्लायर", "type.LEAD": "संभावित ग्राहक",
  "party.balance": "बाकी", "party.overdue": "समय निकला बकाया", "party.entries": "एंट्री", "party.noEntries": "अभी कोई एंट्री नहीं।",
  "party.edit": "बदलें", "party.copyStatement": "स्टेटमेंट लिंक कॉपी करें", "party.remind": "WhatsApp याद दिलाएँ",
  "party.newInvoice": "नया बिल", "party.newQuote": "नया कोटेशन", "party.followUps": "फ़ॉलो-अप", "party.messages": "संदेश",
  "party.invoices": "बिल", "party.history": "भेजे गए संदेश", "party.makeCustomer": "ग्राहक बनाएँ", "party.invite": "ऐप पर बुलाएँ",
  "col.date": "तारीख", "col.details": "विवरण", "col.gave": "आपने दिया", "col.got": "आपको मिला", "col.balance": "बाकी",
  "entry.gave": "आपने दिया (उधार / माल)", "entry.got": "आपको मिला (भुगतान)", "entry.amount": "रकम (₹)", "entry.date": "तारीख",
  "entry.due": "चुकाने की तारीख", "entry.paidBy": "भुगतान का तरीका", "entry.note": "नोट", "entry.save": "एंट्री सेव करें", "entry.saving": "सेव हो रहा है…",
  "entry.notify": "यह एंट्री पार्टी को भेजें", "entry.receipt": "पार्टी को रसीद अपने आप भेजी जाएगी।",
  "entry.notPayment": "भुगतान नहीं (माल मिला)", "entry.reverse": "उलटें", "entry.attach": "बिल / फ़ोटो / PDF जोड़ें",
  "entry.voice": "वॉइस नोट", "entry.stop": "रिकॉर्डिंग रोकें",
  "collect.title": "वसूली", "collect.sub": "किससे वसूली करनी है, और एक साथ याद दिलाएँ", "collect.overdue": "समय निकला",
  "collect.today": "आज देय", "collect.week": "अगले 7 दिन", "collect.all": "सारे बकाया", "collect.daysOverdue": "{range} दिन से बकाया",
  "fu.title": "फ़ॉलो-अप", "fu.due": "आज और पिछले", "fu.upcoming": "आगे के", "fu.done": "हो गए", "fu.mine": "मेरे", "fu.everyone": "सबके",
  "fu.add": "फ़ॉलो-अप जोड़ें", "fu.about": "किस बारे में", "fu.markDone": "हो गया", "fu.call": "कॉल करें",
};

const te: Dict = {
  "nav.home": "హోమ్", "nav.more": "మరిన్ని", "nav.parties": "పార్టీలు", "nav.invoices": "బిల్లులు", "nav.collect": "వసూలు", "nav.followups": "ఫాలో-అప్",
  "nav.items": "వస్తువులు", "nav.settings": "సెట్టింగ్స్", "nav.search": "వెతుకు", "nav.signout": "సైన్ అవుట్",
  "dash.today": "ఈరోజు", "dash.addParty": "పార్టీ చేర్చు", "dash.newInvoice": "కొత్త బిల్లు",
  "dash.toCollect": "రావలసింది", "dash.overdue": "గడువు దాటిన బాకీ", "dash.toPay": "ఇవ్వవలసింది", "dash.collectedToday": "ఈరోజు వసూలు",
  "dash.creditToday": "ఈరోజు ఇచ్చిన అప్పు", "dash.cashToday": "ఈరోజు వచ్చిన నగదు", "dash.followUpsDue": "చేయవలసిన ఫాలో-అప్‌లు",
  "dash.topOverdue": "ఎక్కువ బాకీ ఉన్నవారు", "dash.recent": "ఇటీవలి ఎంట్రీలు", "dash.team": "ఈరోజు టీమ్ పని",
  "dash.nothingOverdue": "గడువు దాటిన బాకీ లేదు", "dash.allWithin": "అన్ని బాకీలు గడువులోపే ఉన్నాయి.",
  "dash.firstCustomer": "అప్పు లెక్క మొదలుపెట్టడానికి మొదటి కస్టమర్‌ను చేర్చండి.", "dash.noEntries": "ఇంకా ఎంట్రీలు లేవు",
  "dash.ofDue": "{amount} బాకీలో", "dash.customize": "మార్చు", "dash.quotesOpen": "ఓపెన్ కొటేషన్లు",
  "bal.toCollect": "రావాలి", "bal.toPay": "ఇవ్వాలి", "bal.settled": "లెక్క సరిపోయింది",
  "parties.title": "పార్టీలు", "parties.search": "పేరు, ఫోన్ లేదా GSTIN తో వెతకండి", "parties.import": "ఇంపోర్ట్",
  "parties.all": "అన్నీ", "parties.customers": "కస్టమర్లు", "parties.suppliers": "సప్లయర్లు", "parties.leads": "లీడ్‌లు", "parties.archived": "ఆర్కైవ్",
  "parties.none": "ఇంకా పార్టీలు లేవు", "parties.noMatch": "పార్టీ దొరకలేదు", "parties.total": "మొత్తం {n}",
  "type.CUSTOMER": "కస్టమర్", "type.SUPPLIER": "సప్లయర్", "type.BOTH": "కస్టమర్ & సప్లయర్", "type.LEAD": "లీడ్",
  "party.balance": "బాకీ", "party.overdue": "గడువు దాటినది", "party.entries": "ఎంట్రీలు", "party.noEntries": "ఇంకా ఎంట్రీలు లేవు.",
  "party.edit": "మార్చు", "party.copyStatement": "స్టేట్‌మెంట్ లింక్ కాపీ", "party.remind": "WhatsApp గుర్తు పంపు",
  "party.newInvoice": "కొత్త బిల్లు", "party.newQuote": "కొత్త కొటేషన్", "party.followUps": "ఫాలో-అప్‌లు", "party.messages": "సందేశాలు",
  "party.invoices": "బిల్లులు", "party.history": "పంపిన సందేశాలు", "party.makeCustomer": "కస్టమర్‌గా మార్చు", "party.invite": "యాప్‌కు ఆహ్వానించు",
  "col.date": "తేదీ", "col.details": "వివరాలు", "col.gave": "మీరు ఇచ్చింది", "col.got": "మీకు వచ్చింది", "col.balance": "బాకీ",
  "entry.gave": "మీరు ఇచ్చింది (అప్పు / సరుకు)", "entry.got": "మీకు వచ్చింది (చెల్లింపు)", "entry.amount": "మొత్తం (₹)", "entry.date": "తేదీ",
  "entry.due": "గడువు తేదీ", "entry.paidBy": "చెల్లింపు విధానం", "entry.note": "నోట్", "entry.save": "ఎంట్రీ సేవ్ చేయి", "entry.saving": "సేవ్ అవుతోంది…",
  "entry.notify": "ఈ ఎంట్రీని పార్టీకి పంపు", "entry.receipt": "పార్టీకి రసీదు ఆటోమేటిక్‌గా వెళ్తుంది.",
  "entry.notPayment": "చెల్లింపు కాదు (సరుకు వచ్చింది)", "entry.reverse": "రద్దు", "entry.attach": "బిల్లు / ఫోటో / PDF జత చేయి",
  "entry.voice": "వాయిస్ నోట్", "entry.stop": "రికార్డింగ్ ఆపు",
  "collect.title": "వసూళ్లు", "collect.sub": "ఎవరి దగ్గర వసూలు చేయాలి, ఒకేసారి గుర్తులు పంపండి", "collect.overdue": "గడువు దాటినవి",
  "collect.today": "ఈరోజు గడువు", "collect.week": "రాబోయే 7 రోజులు", "collect.all": "అన్ని బాకీలు", "collect.daysOverdue": "{range} రోజులు దాటినవి",
  "fu.title": "ఫాలో-అప్‌లు", "fu.due": "ఈరోజు & గడువు దాటినవి", "fu.upcoming": "రాబోయేవి", "fu.done": "పూర్తయినవి", "fu.mine": "నావి", "fu.everyone": "అందరివి",
  "fu.add": "ఫాలో-అప్ చేర్చు", "fu.about": "దేని గురించి", "fu.markDone": "పూర్తయింది", "fu.call": "కాల్ చేయి",
};

const ta: Dict = {
  "nav.home": "முகப்பு", "nav.more": "மேலும்", "nav.parties": "தரப்பினர்", "nav.invoices": "பில்கள்", "nav.collect": "வசூல்", "nav.followups": "பின்தொடர்வு",
  "nav.items": "பொருட்கள்", "nav.settings": "அமைப்புகள்", "nav.search": "தேடு", "nav.signout": "வெளியேறு",
  "dash.today": "இன்று", "dash.addParty": "தரப்பினரைச் சேர்", "dash.newInvoice": "புதிய பில்",
  "dash.toCollect": "வர வேண்டியது", "dash.overdue": "காலம் கடந்த பாக்கி", "dash.toPay": "கொடுக்க வேண்டியது", "dash.collectedToday": "இன்றைய வசூல்",
  "dash.creditToday": "இன்று கொடுத்த கடன்", "dash.cashToday": "இன்று வந்த ரொக்கம்", "dash.followUpsDue": "செய்ய வேண்டிய பின்தொடர்வுகள்",
  "dash.topOverdue": "அதிக பாக்கி உள்ளவர்கள்", "dash.recent": "சமீபத்திய பதிவுகள்", "dash.team": "இன்று குழுவின் வேலை",
  "dash.nothingOverdue": "காலம் கடந்த பாக்கி இல்லை", "dash.allWithin": "எல்லா பாக்கிகளும் கடன் காலத்திற்குள் உள்ளன.",
  "dash.firstCustomer": "கடன் கணக்கைத் தொடங்க முதல் வாடிக்கையாளரைச் சேர்க்கவும்.", "dash.noEntries": "இன்னும் பதிவுகள் இல்லை",
  "dash.ofDue": "{amount} பாக்கியில்", "dash.customize": "மாற்று", "dash.quotesOpen": "திறந்த மதிப்பீடுகள்",
  "bal.toCollect": "வர வேண்டும்", "bal.toPay": "கொடுக்க வேண்டும்", "bal.settled": "கணக்கு சரி",
  "parties.title": "தரப்பினர்", "parties.search": "பெயர், தொலைபேசி அல்லது GSTIN மூலம் தேடவும்", "parties.import": "இறக்குமதி",
  "parties.all": "அனைத்தும்", "parties.customers": "வாடிக்கையாளர்கள்", "parties.suppliers": "சப்ளையர்கள்", "parties.leads": "வாய்ப்புகள்", "parties.archived": "காப்பகம்",
  "parties.none": "இன்னும் தரப்பினர் இல்லை", "parties.noMatch": "பொருந்தும் தரப்பினர் இல்லை", "parties.total": "மொத்தம் {n}",
  "type.CUSTOMER": "வாடிக்கையாளர்", "type.SUPPLIER": "சப்ளையர்", "type.BOTH": "வாடிக்கையாளர் & சப்ளையர்", "type.LEAD": "வாய்ப்பு",
  "party.balance": "பாக்கி", "party.overdue": "காலம் கடந்தது", "party.entries": "பதிவுகள்", "party.noEntries": "இன்னும் பதிவுகள் இல்லை.",
  "party.edit": "திருத்து", "party.copyStatement": "அறிக்கை இணைப்பை நகலெடு", "party.remind": "WhatsApp நினைவூட்டல் அனுப்பு",
  "party.newInvoice": "புதிய பில்", "party.newQuote": "புதிய மதிப்பீடு", "party.followUps": "பின்தொடர்வுகள்", "party.messages": "செய்திகள்",
  "party.invoices": "பில்கள்", "party.history": "அனுப்பிய செய்திகள்", "party.makeCustomer": "வாடிக்கையாளராக மாற்று", "party.invite": "ஆப்புக்கு அழை",
  "col.date": "தேதி", "col.details": "விவரம்", "col.gave": "நீங்கள் கொடுத்தது", "col.got": "உங்களுக்கு வந்தது", "col.balance": "பாக்கி",
  "entry.gave": "நீங்கள் கொடுத்தது (கடன் / சரக்கு)", "entry.got": "உங்களுக்கு வந்தது (பணம்)", "entry.amount": "தொகை (₹)", "entry.date": "தேதி",
  "entry.due": "கெடு தேதி", "entry.paidBy": "செலுத்திய முறை", "entry.note": "குறிப்பு", "entry.save": "பதிவைச் சேமி", "entry.saving": "சேமிக்கிறது…",
  "entry.notify": "இந்தப் பதிவை தரப்பினருக்கு அனுப்பு", "entry.receipt": "தரப்பினருக்கு ரசீது தானாக அனுப்பப்படும்.",
  "entry.notPayment": "பணம் அல்ல (சரக்கு வந்தது)", "entry.reverse": "ரத்து செய்", "entry.attach": "பில் / புகைப்படம் / PDF இணை",
  "entry.voice": "குரல் குறிப்பு", "entry.stop": "பதிவை நிறுத்து",
  "collect.title": "வசூல்", "collect.sub": "யாரிடம் வசூலிக்க வேண்டும், ஒரே நேரத்தில் நினைவூட்டல்கள்", "collect.overdue": "காலம் கடந்தவை",
  "collect.today": "இன்று கெடு", "collect.week": "அடுத்த 7 நாட்கள்", "collect.all": "அனைத்து பாக்கிகள்", "collect.daysOverdue": "{range} நாட்கள் கடந்தவை",
  "fu.title": "பின்தொடர்வுகள்", "fu.due": "இன்று & காலம் கடந்தவை", "fu.upcoming": "வரவிருப்பவை", "fu.done": "முடிந்தவை", "fu.mine": "என்னுடையவை", "fu.everyone": "அனைவரும்",
  "fu.add": "பின்தொடர்வு சேர்", "fu.about": "எதைப் பற்றி", "fu.markDone": "முடிந்தது", "fu.call": "அழை",
};

const kn: Dict = {
  "nav.home": "ಮುಖಪುಟ", "nav.more": "ಇನ್ನಷ್ಟು", "nav.parties": "ಪಾರ್ಟಿಗಳು", "nav.invoices": "ಬಿಲ್‌ಗಳು", "nav.collect": "ವಸೂಲಿ", "nav.followups": "ಫಾಲೋ-ಅಪ್",
  "nav.items": "ವಸ್ತುಗಳು", "nav.settings": "ಸೆಟ್ಟಿಂಗ್ಸ್", "nav.search": "ಹುಡುಕು", "nav.signout": "ಸೈನ್ ಔಟ್",
  "dash.today": "ಇಂದು", "dash.addParty": "ಪಾರ್ಟಿ ಸೇರಿಸಿ", "dash.newInvoice": "ಹೊಸ ಬಿಲ್",
  "dash.toCollect": "ಬರಬೇಕಾದದ್ದು", "dash.overdue": "ಅವಧಿ ಮೀರಿದ ಬಾಕಿ", "dash.toPay": "ಕೊಡಬೇಕಾದದ್ದು", "dash.collectedToday": "ಇಂದಿನ ವಸೂಲಿ",
  "dash.creditToday": "ಇಂದು ಕೊಟ್ಟ ಸಾಲ", "dash.cashToday": "ಇಂದು ಬಂದ ನಗದು", "dash.followUpsDue": "ಮಾಡಬೇಕಾದ ಫಾಲೋ-ಅಪ್‌ಗಳು",
  "dash.topOverdue": "ಹೆಚ್ಚು ಬಾಕಿ ಇರುವವರು", "dash.recent": "ಇತ್ತೀಚಿನ ನಮೂದುಗಳು", "dash.team": "ಇಂದು ತಂಡದ ಕೆಲಸ",
  "dash.nothingOverdue": "ಅವಧಿ ಮೀರಿದ ಬಾಕಿ ಇಲ್ಲ", "dash.allWithin": "ಎಲ್ಲಾ ಬಾಕಿಗಳು ಸಾಲದ ಅವಧಿಯೊಳಗಿವೆ.",
  "dash.firstCustomer": "ಸಾಲದ ಲೆಕ್ಕ ಆರಂಭಿಸಲು ಮೊದಲ ಗ್ರಾಹಕರನ್ನು ಸೇರಿಸಿ.", "dash.noEntries": "ಇನ್ನೂ ನಮೂದುಗಳಿಲ್ಲ",
  "dash.ofDue": "{amount} ಬಾಕಿಯಲ್ಲಿ", "dash.customize": "ಬದಲಿಸಿ", "dash.quotesOpen": "ತೆರೆದ ಕೊಟೇಶನ್‌ಗಳು",
  "bal.toCollect": "ಬರಬೇಕು", "bal.toPay": "ಕೊಡಬೇಕು", "bal.settled": "ಲೆಕ್ಕ ಸರಿ",
  "parties.title": "ಪಾರ್ಟಿಗಳು", "parties.search": "ಹೆಸರು, ಫೋನ್ ಅಥವಾ GSTIN ಮೂಲಕ ಹುಡುಕಿ", "parties.import": "ಆಮದು",
  "parties.all": "ಎಲ್ಲಾ", "parties.customers": "ಗ್ರಾಹಕರು", "parties.suppliers": "ಸರಬರಾಜುದಾರರು", "parties.leads": "ಸಂಭಾವ್ಯ ಗ್ರಾಹಕರು", "parties.archived": "ಆರ್ಕೈವ್",
  "parties.none": "ಇನ್ನೂ ಪಾರ್ಟಿಗಳಿಲ್ಲ", "parties.noMatch": "ಹೊಂದುವ ಪಾರ್ಟಿ ಇಲ್ಲ", "parties.total": "ಒಟ್ಟು {n}",
  "type.CUSTOMER": "ಗ್ರಾಹಕ", "type.SUPPLIER": "ಸರಬರಾಜುದಾರ", "type.BOTH": "ಗ್ರಾಹಕ & ಸರಬರಾಜುದಾರ", "type.LEAD": "ಸಂಭಾವ್ಯ ಗ್ರಾಹಕ",
  "party.balance": "ಬಾಕಿ", "party.overdue": "ಅವಧಿ ಮೀರಿದ್ದು", "party.entries": "ನಮೂದುಗಳು", "party.noEntries": "ಇನ್ನೂ ನಮೂದುಗಳಿಲ್ಲ.",
  "party.edit": "ತಿದ್ದು", "party.copyStatement": "ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಲಿಂಕ್ ನಕಲಿಸಿ", "party.remind": "WhatsApp ನೆನಪು ಕಳುಹಿಸಿ",
  "party.newInvoice": "ಹೊಸ ಬಿಲ್", "party.newQuote": "ಹೊಸ ಕೊಟೇಶನ್", "party.followUps": "ಫಾಲೋ-ಅಪ್‌ಗಳು", "party.messages": "ಸಂದೇಶಗಳು",
  "party.invoices": "ಬಿಲ್‌ಗಳು", "party.history": "ಕಳುಹಿಸಿದ ಸಂದೇಶಗಳು", "party.makeCustomer": "ಗ್ರಾಹಕರನ್ನಾಗಿ ಮಾಡಿ", "party.invite": "ಆ್ಯಪ್‌ಗೆ ಆಹ್ವಾನಿಸಿ",
  "col.date": "ದಿನಾಂಕ", "col.details": "ವಿವರ", "col.gave": "ನೀವು ಕೊಟ್ಟದ್ದು", "col.got": "ನಿಮಗೆ ಬಂದದ್ದು", "col.balance": "ಬಾಕಿ",
  "entry.gave": "ನೀವು ಕೊಟ್ಟದ್ದು (ಸಾಲ / ಸರಕು)", "entry.got": "ನಿಮಗೆ ಬಂದದ್ದು (ಪಾವತಿ)", "entry.amount": "ಮೊತ್ತ (₹)", "entry.date": "ದಿನಾಂಕ",
  "entry.due": "ಕೊನೆಯ ದಿನಾಂಕ", "entry.paidBy": "ಪಾವತಿ ವಿಧಾನ", "entry.note": "ಟಿಪ್ಪಣಿ", "entry.save": "ನಮೂದು ಉಳಿಸಿ", "entry.saving": "ಉಳಿಸುತ್ತಿದೆ…",
  "entry.notify": "ಈ ನಮೂದನ್ನು ಪಾರ್ಟಿಗೆ ಕಳುಹಿಸಿ", "entry.receipt": "ಪಾರ್ಟಿಗೆ ರಸೀದಿ ತಾನಾಗಿಯೇ ಕಳುಹಿಸಲಾಗುತ್ತದೆ.",
  "entry.notPayment": "ಪಾವತಿ ಅಲ್ಲ (ಸರಕು ಬಂತು)", "entry.reverse": "ರದ್ದುಮಾಡಿ", "entry.attach": "ಬಿಲ್ / ಫೋಟೋ / PDF ಲಗತ್ತಿಸಿ",
  "entry.voice": "ಧ್ವನಿ ಟಿಪ್ಪಣಿ", "entry.stop": "ರೆಕಾರ್ಡಿಂಗ್ ನಿಲ್ಲಿಸಿ",
  "collect.title": "ವಸೂಲಿ", "collect.sub": "ಯಾರಿಂದ ವಸೂಲಿ ಮಾಡಬೇಕು, ಒಮ್ಮೆಲೇ ನೆನಪುಗಳು", "collect.overdue": "ಅವಧಿ ಮೀರಿದವು",
  "collect.today": "ಇಂದು ಕೊನೆಯ ದಿನ", "collect.week": "ಮುಂದಿನ 7 ದಿನ", "collect.all": "ಎಲ್ಲಾ ಬಾಕಿಗಳು", "collect.daysOverdue": "{range} ದಿನ ಮೀರಿದವು",
  "fu.title": "ಫಾಲೋ-ಅಪ್‌ಗಳು", "fu.due": "ಇಂದು & ಅವಧಿ ಮೀರಿದವು", "fu.upcoming": "ಮುಂಬರುವವು", "fu.done": "ಮುಗಿದವು", "fu.mine": "ನನ್ನವು", "fu.everyone": "ಎಲ್ಲರವು",
  "fu.add": "ಫಾಲೋ-ಅಪ್ ಸೇರಿಸಿ", "fu.about": "ಯಾವುದರ ಬಗ್ಗೆ", "fu.markDone": "ಮುಗಿಯಿತು", "fu.call": "ಕರೆ ಮಾಡಿ",
};

const DICTS: Record<UiLang, Dict> = { en, hi, te, ta, kn };

export type T = (key: UiKey, vars?: Record<string, string | number>) => string;

export function translator(lang: string): T {
  const d = DICTS[lang as UiLang] ?? en;
  return (key, vars) => {
    let s = d[key] ?? en[key];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
}
