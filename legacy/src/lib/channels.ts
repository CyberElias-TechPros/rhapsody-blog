export type Channel = {
  slug: string;
  name: string;
  username: string; // telegram @handle without @
  url: string;
  description: string;
  accent: string; // tailwind gradient classes
};

export const CHANNELS: Channel[] = [
  {
    slug: "rhapsody-of-realities",
    name: "Rhapsody of Realities",
    username: "rhapsody_of_realities",
    url: "https://t.me/s/rhapsody_of_realities",
    description: "Daily devotionals from the world's #1 daily devotional — giving your life a meaning.",
    accent: "from-primary to-primary-glow",
  },
  {
    slug: "pastor-chris-teachings",
    name: "Pastor Chris Teachings",
    username: "PastorChrisOyakhilomeMessageText",
    url: "https://t.me/s/PastorChrisOyakhilomeMessageText",
    description: "Inspired teachings and messages from Pastor Chris Oyakhilome.",
    accent: "from-amber-600 to-orange-500",
  },
  {
    slug: "pastor-chris-books",
    name: "Pastor Chris Books",
    username: "pastorchrisbooks",
    url: "https://t.me/s/pastorchrisbooks",
    description: "Excerpts and full chapters from Pastor Chris' transformative books.",
    accent: "from-rose-600 to-amber-500",
  },
  {
    slug: "rhapsody-library",
    name: "Rhapsody of Realities Library",
    username: "rhapsodylibrary",
    url: "https://t.me/s/rhapsodylibrary",
    description: "A growing library of resources, testimonies and editions.",
    accent: "from-emerald-600 to-amber-500",
  },
  {
    slug: "classic-gospel-music",
    name: "Classic Gospel Music",
    username: "classicgospelmusic",
    url: "https://t.me/s/classicgospelmusic",
    description: "Timeless gospel music to lift your spirit every day.",
    accent: "from-indigo-600 to-primary-glow",
  },
];

export const getChannel = (slug: string) => CHANNELS.find(c => c.slug === slug);
