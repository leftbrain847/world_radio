// Invented sample rows shaped like Radio Browser's /json/stations/search output (not real stations).
const row = (o) => ({ stationuuid: o.id, name: o.name, url: o.url, url_resolved: o.url, votes: o.votes, state: o.state ?? '', tags: o.tags ?? 'noticias,música', codec: 'MP3', bitrate: 128, homepage: o.homepage ?? '' });

export const FIXTURE = {
  MX: [
    row({ id: 'mx1', name: 'Radio Uno', url: 'https://stream.example.test/uno', votes: 900, state: 'CDMX', homepage: 'https://example.test' }),
    row({ id: 'mx1b', name: 'Radio Uno', url: 'https://stream.example.test/uno-alt', votes: 400 }),
    row({ id: 'mx2', name: 'HTTP Only FM', url: 'http://stream.example.test/plain', votes: 800 }),
    row({ id: 'mx3', name: 'La\u0007 Norteña', url: 'https://stream.example.test/nortena', votes: 600, state: 'Monterrey', homepage: 'http://insecure.example.test' }),
    row({ id: 'mx4', name: 'Sonido Jalisco', url: 'https://stream.example.test/jalisco', votes: 50, state: 'Guadalajara' }),
  ],
  PE: [
    row({ id: 'pe1', name: 'Radio Andina', url: 'https://stream.example.test/andina', votes: 300, state: 'Cusco' }),
    row({ id: 'pe2', name: 'Lima Noticias', url: 'https://stream.example.test/lima', votes: 200, state: 'Lima' }),
  ],
};
