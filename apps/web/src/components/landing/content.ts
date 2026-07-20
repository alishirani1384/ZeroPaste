export const LANDING_NAV = {
  logo: { href: "/landing", label: "ZeroPaste" },
  cta: { href: "#download", label: "Try for free" },
} as const;

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

export const TESTIMONIALS = [
  {
    name: "Alexander Akers",
    role: "Software Engineer",
    company: "Apple",
    quote:
      "I get worried when I use a computer without @paste_app. What if there’s something important on the clipboard? It’s like how you can “hold” a piece in Tetris but you have to remember what it is.",
    avatar: "/landing/testimonial-1.webp",
  },
  {
    name: "João Cunha",
    role: "Product Manager",
    company: "Nubank",
    quote:
      "Few things have had as much impact on my Mac workflow as @paste_app. It may look irrelevant, but think of how many times you copy/paste things over the course of a day — Paste makes this process a gazillion times better.",
    avatar: "/landing/testimonial-2.webp",
  },
  {
    name: "Jonathan Z. White",
    role: "Designer & Developer",
    company: "Airbnb",
    quote:
      "I’ve been using an app called @paste_app and it’s almost hilarious how much of a work flow improvement it is.",
    avatar: "/landing/testimonial-3.webp",
  },
  {
    name: "Chris Messina",
    role: "Hashtag Inventor",
    company: "",
    quote:
      "This is a must-have Mac app for me. I use it dozens if not hundreds of times a day. So useful!",
    avatar: "/landing/testimonial-4.webp",
  },
  {
    name: "Kristen Wright",
    role: "Marketing",
    company: "Day One Journal",
    quote:
      "Finally bought @paste_app and I’m really digging it. Great for code snippets, hex colors & links you frequently use.",
    avatar: "/landing/testimonial-5.webp",
  },
  {
    name: "Diego Freniche Brito",
    role: "Developer Advocate",
    company: "MongoDB",
    quote:
      "Using a clipboard manager has become second nature for me (and a necessity as developer). Have tried a bunch. @paste_app is the best by far. Instabuy.",
    avatar: "/landing/testimonial-6.webp",
  },
] as const;

export const PRICING_PLANS = [
  { id: "monthly", label: "Monthly", price: "$2.49", suffix: "/month", note: "", save: "" },
  {
    id: "annual",
    label: "Annual",
    price: "$2.49",
    suffix: "/month",
    note: "$29.99 billed annually",
    save: "Save 37%",
  },
  {
    id: "lifetime",
    label: "Lifetime",
    price: "$69.99",
    suffix: "",
    note: "One-time purchase",
    save: "",
  },
] as const;
