export const LANDING_NAV = {
  logo: { href: "/landing", label: "ZeroPaste" },
  cta: { href: "/landing/download", label: "Try for free" },
} as const;

/** Update these when release / store listings go live. */
export const DOWNLOAD_LINKS = {
  githubReleases: "https://github.com/OWNER/REPO/releases/latest",
  myket: "#",
  bazaar: "#",
} as const;

export const DOWNLOAD_HERO = {
  title: "Try ZeroPaste for free",
  subtitle:
    "Everything you copy is saved, searchable, and in sync on your Windows, Linux, and Android devices.",
  image: {
    src: "/landing/download-hero-cards.png",
    alt: "ZeroPaste clipboard history cards with a Free Forever card in front",
    width: 1920,
    height: 840,
  },
  note: "Available for Windows, Linux, and Android.",
} as const;

export const DOWNLOAD_PLATFORMS = [
  {
    id: "windows",
    label: "Windows",
    description: "Windows 10 or later",
    options: [
      {
        id: "github",
        label: "GitHub Releases",
        href: DOWNLOAD_LINKS.githubReleases,
        primary: true,
      },
    ],
  },
  {
    id: "linux",
    label: "Linux",
    description: "AppImage and packages",
    options: [
      {
        id: "github",
        label: "GitHub Releases",
        href: DOWNLOAD_LINKS.githubReleases,
        primary: true,
      },
    ],
  },
  {
    id: "android",
    label: "Android",
    description: "Phone and tablet",
    options: [
      {
        id: "github",
        label: "GitHub Releases",
        href: DOWNLOAD_LINKS.githubReleases,
        primary: true,
      },
      {
        id: "myket",
        label: "Myket",
        href: DOWNLOAD_LINKS.myket,
        primary: false,
      },
      {
        id: "bazaar",
        label: "Café Bazaar",
        href: DOWNLOAD_LINKS.bazaar,
        primary: false,
      },
    ],
  },
] as const;

export const DOWNLOAD_TRIAL = {
  title: "How the free forever works",
  subtitle: "Free Forever, every feature, all your devices.",
  cards: [
    {
      id: "unlocked",
      title: "Everything unlocked",
      body: "Unlimited clipboard history, pinboards, search, and sync across your devices. The full ZeroPaste, not a demo.",
      icon: "star" as const,
    },
    {
      id: "decide",
      title: "Try first, decide later",
      body: "Use ZeroPaste for free forever. Donate only if you’d like to support us.",
      icon: "calendar" as const,
    },
    {
      id: "devices",
      title: "Sync across all your devices",
      body: "Start on one device and ZeroPaste unlocks on all the others, Windows, Linux, and Android devices included.",
      icon: "devices" as const,
    },
  ],
} as const;

export const DOWNLOAD_FAQ = [
  {
    question: "Where can I download ZeroPaste?",
    answer:
      "Windows and Linux builds are on GitHub Releases. On Android you can install from GitHub Releases, Myket, or Café Bazaar — same app, your choice of store.",
  },
  {
    question: "What’s the difference between GitHub and Iranian stores?",
    answer:
      "It’s the same ZeroPaste either way. GitHub Releases gives you the APK directly. Myket and Café Bazaar are convenient if you prefer installing through an Iranian store, with their update flow.",
  },
  {
    question: "Do I need to pay or enter a credit card?",
    answer:
      "No. ZeroPaste is free forever. Download it and use every feature — no trial clock, no card required. Donations are optional if you want to support the project.",
  },
  {
    question: "Which platforms are supported?",
    answer:
      "ZeroPaste runs on Windows, Linux, and Android. Clipboard history syncs across the devices you sign in on.",
  },
] as const;

export const PRESS_LOGOS = [
  {
    src: "/landing/press-invaluable.svg",
    alt: "Invaluable Utility",
    width: 124,
    height: 20,
  },
  {
    src: "/landing/press-ratings.svg",
    alt: "4.5 stars, 16k+ ratings",
    width: 92,
    height: 20,
  },
  {
    src: "/landing/press-tnw.svg",
    alt: "The Next Web",
    width: 62,
    height: 20,
  },
  {
    src: "/landing/press-9to5mac.svg",
    alt: "9to5Mac",
    width: 86,
    height: 20,
  },
  {
    src: "/landing/press-lifehacker.svg",
    alt: "Lifehacker",
    width: 64,
    height: 20,
  },
] as const;

export const FEATURES = [
  {
    id: "many-ways",
    title: "Many ways to Paste",
    body: "Paste multiple items in the order you choose. Keep the original formatting or switch to plain text.",
    image: "/landing/feature-many-ways.png",
  },
  {
    id: "custom-rules",
    title: "Custom rules",
    body: "Choose what to keep and what to exclude. Specify rules for apps with sensitive data like passwords.",
    image: "/landing/feature-custom-rules.png",
  },
  {
    id: "preview",
    title: "Preview and edit",
    body: "Preview your links, images, and files. Edit your copied text without leaving Paste.",
    image: "/landing/feature-preview-edit.png",
  },
] as const;

export const AUDIENCES = [
  {
    id: "developers",
    title: "Developers",
    body: "Copy a code snippet from Stack Overflow, then copy another without overwriting the first. With Paste, all your code snippets are saved and neatly organized.",
    icon: "/landing/icon-developers.svg",
    className: "min-[62.5rem]:top-[1110px] min-[62.5rem]:left-[192px]",
  },
  {
    id: "designers",
    title: "Designers",
    body: "Just as any great artist keeps their palette close at hand, Paste enables you to quickly retrieve colors, icons, styles, and other assets whenever you need them.",
    icon: "/landing/icon-designers.svg",
    className: "min-[62.5rem]:top-[1110px] min-[62.5rem]:left-[606px]",
  },
  {
    id: "content",
    title: "Content and Marketing",
    body: "Never lose a chunk of text you forgot to paste back. Save creative taglines, SEO keywords, and anything else that aids your process. Say more with Paste.",
    icon: "/landing/icon-content.svg",
    className: "min-[62.5rem]:top-[1398px] min-[62.5rem]:left-[192px]",
  },
  {
    id: "sales",
    title: "Sales and Support",
    body: "Store email templates and canned replies, and quickly access your most-used messages with a single keyboard shortcut in any app.",
    icon: "/landing/icon-sales.svg",
    className: "min-[62.5rem]:top-[1398px] min-[62.5rem]:left-[606px]",
  },
] as const;

export const DONORS = [
  {
    name: "Ali R.",
    note: "Keep building — ZeroPaste saved me hours already.",
    amount: "$25",
    avatar: "/landing/testimonial-1.webp",
  },
  {
    name: "Sara M.",
    note: "Happy to support open, private clipboard tools.",
    amount: "$10",
    avatar: "/landing/testimonial-2.webp",
  },
  {
    name: "Anonymous",
    note: "Free forever is rare. Here’s a coffee.",
    amount: "$5",
    avatar: "/landing/testimonial-3.webp",
  },
  {
    name: "Reza K.",
    note: "Sync across Windows and Android just works.",
    amount: "$50",
    avatar: "/landing/testimonial-4.webp",
  },
  {
    name: "Neda P.",
    note: "Donated so more people can find this.",
    amount: "$15",
    avatar: "/landing/testimonial-5.webp",
  },
  {
    name: "Dev from Tehran",
    note: "Appreciate the Myket option and E2E sync.",
    amount: "$20",
    avatar: "/landing/testimonial-6.webp",
  },
] as const;

/** Update wallet addresses and contact when ready. */
export const DONATION = {
  title: ["Support ZeroPaste", "if you love it"] as const,
  subtitle:
    "ZeroPaste is free forever. Donations keep development going — send crypto, or just say hello.",
  crypto: [
    {
      id: "btc",
      label: "Bitcoin",
      network: "BTC",
      address: "bc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    },
    {
      id: "eth",
      label: "Ethereum",
      network: "ERC-20",
      address: "0x0000000000000000000000000000000000000000",
    },
    {
      id: "usdt",
      label: "USDT",
      network: "TRC-20",
      address: "TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    },
  ],
  contact: {
    label: "Contact me",
    description: "Prefer another way to donate, or just want to chat? Reach out.",
    email: "hello@zeropaste.app",
    x: "https://x.com/zeropaste",
  },
} as const;
