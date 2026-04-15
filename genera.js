const fs = require('fs');
const path = require('path');

const CONTENUTI_FILE = path.join(__dirname, 'public', 'contenuti.json');
const SONDAGGIO_FILE = path.join(__dirname, 'public', 'sondaggio.json');
const FANTA_FILE     = path.join(__dirname, 'public', 'fantacalcio.json');
const MAX_TENTATIVI  = 3;

const RSS_FEEDS = [
  'https://www.gazzetta.it/rss/calcio.xml',
  'https://www.corrieredellosport.it/rss/calcio.xml',
  'https://www.ansa.it/sport/notizie/calcio/calcio_rss.xml'
];

async function leggiRSS(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const titoli = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const titoloRegex = /<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i;
    const descRegex = /<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>/i;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && titoli.length < 8) {
      const item = match[1];
      const tMatch = titoloRegex.exec(item);
      const dMatch = descRegex.exec(item);
      if (tMatch) {
        const titolo = (tMatch[1] || tMatch[2] || '').trim().replace(/<[^>]+>/g, '');
        const desc = dMatch ? (dMatch[1] || dMatch[2] || '').trim().replace(/<[^>]+>/g, '').substring(0, 150) : '';
        if (titolo && titolo.length > 5) titoli.push({ titolo, desc });
      }
    }
    return titoli;
  } catch (e) {
    console.log(`RSS ${url} fallito: ${e.message}`);
    return [];
  }
}

async function leggiTuttiRSS() {
  console.log('Lettura feed RSS...');
  const risultati = await Promise.all(RSS_FEEDS.map(leggiRSS));
  const tutti = risultati.flat();
  const unici = tutti.filter((item, idx, arr) =>
    arr.findIndex(x => x.titolo.substring(0, 30) === item.titolo.substring(0, 30)) === idx
  );
  console.log(`Notizie reali trovate: ${unici.length}`);
  return unici.slice(0, 20);
}

function leggiFantacalcio() {
  try {
    if (!fs.existsSync(FANTA_FILE)) return null;
    return JSON.parse(fs.readFileSync(FANTA_FILE, 'utf8'));
  } catch(e) {
    console.log('Errore lettura fantacalcio.json:', e.message);
    return null;
  }
}

function fantaRiepilogo(fanta) {
  if (!fanta) return 'Dati fantacalcio non disponibili.';

  const classifica = fanta.squadre
    .map((s, i) => `${i+1}. ${s.squadra} - ${s.punti} pt (tot. ${s.pt_totali})`)
    .join(', ');

  let risultati = '';
  if (fanta.ultima_giornata && fanta.ultima_giornata.risultati) {
    risultati = fanta.ultima_giornata.risultati
      .map(r => `${r.casa} ${r.gol_casa}-${r.gol_fuori} ${r.fuori} (voti: ${r.pt_casa} vs ${r.pt_fuori})`)
      .join(', ');
  }

  return `Giornata ${fanta.giornata}. Classifica: ${classifica}. Risultati ultima giornata: ${risultati}`;
}

async function chiamaDeepSeek(oggi, notizie, fantaRiep) {
  const notizieTesto = notizie.length > 0
    ? notizie.map((n, i) => `${i+1}. ${n.titolo}${n.desc ? ' — ' + n.desc : ''}`).join('\n')
    : 'Nessuna notizia disponibile.';

  const prompt = `Sei la redazione de "La Sarkietta dello Sport", giornale satirico italiano per amici 40enni appassionati di calcio e fantacalcio.
Oggi e' ${oggi}.

NOTIZIE REALI DI OGGI (da Gazzetta, Corriere Sport, ANSA):
${notizieTesto}

DATI REALI FANTACALCIO SARKIASUPERLEGA:
${fantaRiep}

Il tuo compito:
- Per Milan, Juve, Inter, Serie A: rielabora le notizie reali in chiave ironica
- Per Crotone, sport minori, sondaggio: inventa liberamente in modo assurdo
- Per fantacalcio: usa i dati reali della Sarkiasuperlega e crea narrazione ironica
- fanta_flop: commenta ironicamente la squadra/giocatore con peggior prestazione reale
- fanta_top: esalta la squadra/giocatore migliore con ironia
- fanta_commento: commento generale ironico sulla giornata della lega
- Ogni testo max 20 parole, tutto su una riga senza a capo

Rispondi SOLO con questo JSON valido, zero markdown, zero backtick:

{"crotone":{"titolo":"...","sottotitolo":"...","testo":"..."},"milan":{"titolo":"...","testo":"...","badge":"Crisi Nera"},"juve":{"titolo":"...","testo":"...","badge":"Fenomeno?"},"inter":{"titolo":"...","testo":"...","badge":"Bidone d'Oro"},"seriea_extra":{"titolo":"...","testo":"...","team":"..."},"seriea_extra2":{"titolo":"...","testo":"...","team":"..."},"fanta_flop":{"titolo":"...","testo":"...","squadra":"..."},"fanta_top":{"titolo":"...","testo":"...","squadra":"..."},"fanta_commento":"...","minori_tennis":{"titolo":"...","testo":"..."},"minori_f1":{"titolo":"...","testo":"..."},"minori_altro":{"categoria":"...","titolo":"...","testo":"..."},"ticker":["...","...","...","...","..."],"sondaggio_domanda":"...","sondaggio_opzioni":["...","...","...","..."],"vincenti":[{"nome":"...","testo":"..."},{"nome":"...","testo":"..."}]}

Sostituisci ogni "..." con contenuto reale rielaborato o ironico. Crotone sempre protagonista assurdo.`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 8192,
      temperature: 0.8,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  console.log('Finish reason:', data.choices[0].finish_reason);
  console.log('Tokens:', JSON.stringify(data.usage));

  let raw = data.choices[0].message.content.trim();
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();

  const start = raw.indexOf('{');
  if (start === -1) throw new Error('Nessun JSON trovato');
  raw = raw.substring(start);
  const lastBrace = raw.lastIndexOf('}');
  if (lastBrace > 0) raw = raw.substring(0, lastBrace + 1);

  raw = raw.replace(/[\r\n\t]/g, ' ').replace(/  +/g, ' ').trim();

  let open = 0, close = 0, inStr = false, escape = false;
  for (const c of raw) {
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (!inStr) {
      if (c === '{') open++;
      if (c === '}') close++;
    }
  }
  const missing = open - close;
  if (missing > 0) {
    raw += '}'.repeat(missing);
    console.log('Riparati', missing, 'chiusure }');
  }

  return JSON.parse(raw);
}

async function genera() {
  console.log('=== Sarkietta generazione contenuti ===');
  console.log('Data:', new Date().toISOString());

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const [notizie, fanta] = await Promise.all([
    leggiTuttiRSS(),
    Promise.resolve(leggiFantacalcio())
  ]);

  const fantaRiep = fantaRiepilogo(fanta);
  console.log('Dati fanta:', fantaRiep.substring(0, 100) + '...');

  let contenuti = null;
  let erroreFinale = null;

  for (let tentativo = 1; tentativo <= MAX_TENTATIVI; tentativo++) {
    console.log(`\nTentativo ${tentativo}/${MAX_TENTATIVI}...`);
    try {
      contenuti = await chiamaDeepSeek(oggi, notizie, fantaRiep);
      // Aggiungi i dati grezzi del fanta al JSON salvato
      contenuti.fanta_data = fanta;
      console.log(`Tentativo ${tentativo} riuscito!`);
      break;
    } catch (err) {
      erroreFinale = err;
      console.log(`Tentativo ${tentativo} fallito: ${err.message}`);
      if (tentativo < MAX_TENTATIVI) {
        const pausa = tentativo * 10000;
        console.log(`Attendo ${pausa/1000}s...`);
        await new Promise(r => setTimeout(r, pausa));
      }
    }
  }

  if (!contenuti) {
    console.log('\nTutti i tentativi falliti. Uso fallback.');
    if (fs.existsSync(CONTENUTI_FILE)) {
      const vecchi = JSON.parse(fs.readFileSync(CONTENUTI_FILE, 'utf8'));
      vecchi.generato_il = new Date().toISOString();
      vecchi.fallback = true;
      if (vecchi.ticker) vecchi.ticker[0] = 'Redazione in pausa tecnica, torniamo domani';
      contenuti = vecchi;
    } else {
      contenuti = {
        generato_il: new Date().toISOString(),
        fallback: true,
        crotone: { titolo: 'Redazione in pausa tecnica', sottotitolo: 'Pausa Tecnica', testo: 'Torniamo domani.' },
        milan: { titolo: 'Notizie in aggiornamento', testo: 'Torniamo domani.', badge: 'Crisi Nera' },
        juve: { titolo: 'Notizie in aggiornamento', testo: 'Torniamo domani.', badge: 'Fenomeno?' },
        inter: { titolo: 'Notizie in aggiornamento', testo: 'Torniamo domani.', badge: "Bidone d'Oro" },
        seriea_extra: { titolo: 'Aggiornamento in corso', testo: 'Torniamo domani.', team: 'Serie A' },
        seriea_extra2: { titolo: 'Aggiornamento in corso', testo: 'Torniamo domani.', team: 'Serie A' },
        fanta_flop: { titolo: 'Dati in aggiornamento', testo: 'Torniamo domani.', squadra: '' },
        fanta_top: { titolo: 'Dati in aggiornamento', testo: 'Torniamo domani.', squadra: '' },
        fanta_commento: 'La Sarkiasuperlega si prende una pausa. Torniamo domani.',
        fanta_data: fanta,
        minori_tennis: { titolo: 'Aggiornamento in corso', testo: 'Torniamo domani.' },
        minori_f1: { titolo: 'Aggiornamento in corso', testo: 'Torniamo domani.' },
        minori_altro: { categoria: 'Sport', titolo: 'Aggiornamento in corso', testo: 'Torniamo domani.' },
        ticker: ['Redazione in pausa tecnica', 'Torniamo domani', 'Il Crotone si allena', 'Restate sintonizzati', 'Notizie fresche domani'],
        sondaggio_domanda: 'Cosa fai quando il sito non si aggiorna?',
        sondaggio_opzioni: ['Aspetto paziente', 'Mi arrabbio', 'Guardo la TV', 'Vado al bar'],
        vincenti: [
          { nome: 'La Redazione', testo: 'Torna domani con contenuti freschi.' },
          { nome: 'Il Crotone', testo: 'Sempre nel nostro cuore.' }
        ]
      };
    }
  }

  contenuti.generato_il = new Date().toISOString();
  fs.writeFileSync(CONTENUTI_FILE, JSON.stringify(contenuti, null, 2), 'utf8');

  if (!contenuti.fallback || !fs.existsSync(SONDAGGIO_FILE)) {
    const sondaggio = {
      domanda: contenuti.sondaggio_domanda,
      opzioni: contenuti.sondaggio_opzioni,
      voti: [0, 0, 0, 0],
      data: new Date().toDateString()
    };
    fs.writeFileSync(SONDAGGIO_FILE, JSON.stringify(sondaggio, null, 2), 'utf8');
  }

  console.log('\nContenuti salvati:', new Date().toISOString());
  console.log('Notizie reali usate:', notizie.length);
  console.log('Fanta data disponibile:', !!fanta);
}

genera().catch(err => {
  console.error('ERRORE CRITICO:', err.message);
  process.exit(0);
});
