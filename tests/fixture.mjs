// Invented sample rows shaped like Radio Browser's API output (not real stations).
const row = (o) => ({ stationuuid: o.id, name: o.name, url: o.url, url_resolved: o.url, votes: o.votes, state: o.state ?? '', language: o.language ?? 'english', tags: o.tags ?? 'news,music', codec: 'MP3', bitrate: 128 });

export const FIXTURE = {
  JP: [
    row({ id: 'jp1', name: 'Radio One', url: 'https://stream.example.test/one', votes: 900, state: 'Tokyo', language: 'japanese' }),
    row({ id: 'jp1b', name: 'Radio One', url: 'https://stream.example.test/one-alt', votes: 400 }),
    row({ id: 'jp2', name: 'HTTP Only FM', url: 'http://stream.example.test/plain', votes: 800 }),
    row({ id: 'jp3', name: 'Night\u0007 Jazz', url: 'https://stream.example.test/jazz', votes: 600, state: 'Osaka' }),
    row({ id: 'jp4', name: 'City Pop', url: 'https://stream.example.test/citypop', votes: 50 }),
  ],
  NG: [
    row({ id: 'ng1', name: 'Lagos Talk', url: 'https://stream.example.test/lagos', votes: 300, state: 'Lagos' }),
    row({ id: 'ng2', name: 'Abuja Hits', url: 'https://stream.example.test/abuja', votes: 200, state: 'Abuja' }),
  ],
};

export const COUNTRIES = [
  { name: 'Japan', iso_3166_1: 'JP', stationcount: 400 },
  { name: 'Nigeria', iso_3166_1: 'NG', stationcount: 90 },
  { name: 'The United States Of America', iso_3166_1: 'US', stationcount: 6000 },
  { name: 'Tiny Isle', iso_3166_1: 'TI', stationcount: 3 },
  { name: 'Empty Land', iso_3166_1: 'EL', stationcount: 0 },
  { name: 'Broken', iso_3166_1: 'XYZ', stationcount: 50 },
  { name: 'Japan', iso_3166_1: 'jp', stationcount: 10 },
];
