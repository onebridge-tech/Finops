// Words for the landing page in the five app languages. Written for shop owners, not for developers.
export type LandingLang = "en" | "te" | "hi" | "ta" | "kn";

export const LANG_LABEL: Record<LandingLang, string> = { en: "English", te: "తెలుగు", hi: "हिन्दी", ta: "தமிழ்", kn: "ಕನ್ನಡ" };

export const HERO: Record<LandingLang, { title: string; sub: string; cta: string; hello: string; msg: string }> = {
  en: {
    title: "Know who owes you. Get paid faster.",
    sub: "Write down who owes you, ask for the money on WhatsApp, and make GST bills — all in a few taps.",
    cta: "Start free",
    hello: "Hello",
    msg: "Hello Ravi, a friendly reminder from Sri Tea Stall: ₹4,100 is due. View and pay here.",
  },
  te: {
    title: "మీకు ఎవరు బాకీ ఉన్నారో తెలుసుకోండి. త్వరగా డబ్బు పొందండి.",
    sub: "ఎవరు ఎంత ఇవ్వాలో రాసుకోండి, WhatsApp లో డబ్బు అడగండి, GST బిల్లులు చేయండి — కొన్ని నొక్కులతోనే.",
    cta: "ఉచితంగా మొదలుపెట్టండి",
    hello: "నమస్కారం",
    msg: "నమస్కారం రవి గారు, శ్రీ టీ స్టాల్ నుండి గుర్తు చేస్తున్నాం: ₹4,100 రావాల్సి ఉంది. ఇక్కడ చూసి చెల్లించండి.",
  },
  hi: {
    title: "जानें किसे आपको देना है। जल्दी पैसा पाएँ।",
    sub: "लिखें किसे कितना देना है, WhatsApp पर पैसा माँगें, GST बिल बनाएँ — बस कुछ टैप में।",
    cta: "मुफ़्त शुरू करें",
    hello: "नमस्ते",
    msg: "नमस्ते रवि जी, श्री टी स्टॉल की ओर से याद दिलाना: ₹4,100 देय है। यहाँ देखें और भुगतान करें।",
  },
  ta: {
    title: "யார் உங்களுக்குத் தர வேண்டும் என்று அறியுங்கள். விரைவாகப் பணம் பெறுங்கள்.",
    sub: "யார் எவ்வளவு தர வேண்டும் என்று எழுதுங்கள், WhatsApp-இல் பணம் கேளுங்கள், GST பில் போடுங்கள் — சில தட்டுகளில்.",
    cta: "இலவசமாகத் தொடங்குங்கள்",
    hello: "வணக்கம்",
    msg: "வணக்கம் ரவி, ஸ்ரீ டீ ஸ்டாலிலிருந்து நினைவூட்டல்: ₹4,100 செலுத்த வேண்டியுள்ளது. இங்கே பார்த்துச் செலுத்துங்கள்.",
  },
  kn: {
    title: "ಯಾರು ನಿಮಗೆ ಕೊಡಬೇಕು ಎಂದು ತಿಳಿಯಿರಿ. ಬೇಗ ಹಣ ಪಡೆಯಿರಿ.",
    sub: "ಯಾರು ಎಷ್ಟು ಕೊಡಬೇಕು ಎಂದು ಬರೆಯಿರಿ, WhatsApp ನಲ್ಲಿ ಹಣ ಕೇಳಿ, GST ಬಿಲ್ ಮಾಡಿ — ಕೆಲವೇ ಟ್ಯಾಪ್‌ಗಳಲ್ಲಿ.",
    cta: "ಉಚಿತವಾಗಿ ಆರಂಭಿಸಿ",
    hello: "ನಮಸ್ಕಾರ",
    msg: "ನಮಸ್ಕಾರ ರವಿ, ಶ್ರೀ ಟೀ ಸ್ಟಾಲ್‌ನಿಂದ ನೆನಪೋಲೆ: ₹4,100 ಬಾಕಿ ಇದೆ. ಇಲ್ಲಿ ನೋಡಿ ಪಾವತಿಸಿ.",
  },
};

/** Picks the visitor's language from their browser settings, falling back to English. */
export function guessLang(tags: readonly string[]): LandingLang {
  for (const t of tags) {
    const code = t.slice(0, 2).toLowerCase();
    if (code === "te" || code === "hi" || code === "ta" || code === "kn") return code;
  }
  return "en";
}
