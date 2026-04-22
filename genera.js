const fs = require('fs');
const path = require('path');

const CONTENUTI_FILE = path.join(__dirname, 'public', 'contenuti.json');
const SONDAGGIO_FILE = path.join(__dirname, 'public', 'sondaggio.json');
const FANTA_FILE     = path.join(__dirname, 'public', 'fantacalcio.json');

function leggiFantacalcio() {
  try {
    if (!fs.existsSync(FANTA_FILE)) return null;
    return JSON.parse(fs.readFileSync(FANTA_FILE, 'utf8'));
  } catch(e) { return null; }
}

function fantaRiepilogo(fanta) {
  if (!fanta) return 'Dati fantacalcio non disponibili.';
  const classifica = fanta.squadre.map((s,i) => `${i+1}. ${s.squadra} ${s.punti}pt`).join(', ');
  let risultati = '';
  if (fanta.ultima_giornata && fanta.ultima_giornata.risultati) {
    risultati = fanta.ultima_giornata.risultati
      .map(r => `${r.casa} ${r.gol_casa}-${r.gol_fuori} ${r.fuori}`).join('; ');
  }
  return `${fanta.giornata}. Classifica: ${classifica}. Risultati: ${risultati}`;
}

async function cercaNotizie() {
  try {
    const res = await fetch('https://sarkietta.it/rss_proxy.php', {
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return { calcio: [], f1: [], moto: [], tennis: [], tutti: [] };
    const data = await res.json();
    const risultato = {
      calcio:  data.calcio  || [],
      f1:      data.f1      || [],
      moto:    data.moto    || [],
      tennis:  data.tennis  || [],
      crotone: data.crotone || [],
      tutti:   data.titoli  || []
    };
    console.log(`Notizie: calcio=${risultato.calcio.length}, f1=${risultato.f1.length}, moto=${risultato.moto.length}, tennis=${risultato.tennis.length}`);
    risultato.calcio.slice(0,4).forEach((t,i) => console.log(`  calcio ${i+1}. ${t.substring(0,80)}`));
    return risultato;
  } catch(e) {
    console.log('Proxy RSS fallito:', e.message);
    return { calcio: [], f1: [], moto: [], tennis: [], tutti: [] };
  }
}

function pulisciRaw(raw) {
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Nessun JSON trovato');
  raw = raw.substring(start, end + 1);
  raw = raw.replace(/[\r\n\t]/g, ' ').replace(/ {2,}/g, ' ').trim();
  raw = raw.replace(/([a-zA-Z])'([a-zA-ZÀ-ù])/g, '$1$2');
  raw = raw.replace(/[\u2018\u2019\u201C\u201D]/g, '');
  let open = 0, close = 0, inStr = false, escape = false;
  for (const c of raw) {
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (!inStr) { if (c === '{') open++; if (c === '}') close++; }
  }
  if (open - close > 0) raw += '}'.repeat(open - close);
  return raw;
}

async function callDeepSeek(prompt, system) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(60000),
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 3000,
      temperature: 1.1,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${await response.text()}`);
  const data = await response.json();
  console.log('Tokens:', data.usage.total_tokens);
  return data.choices[0].message.content.trim();
}

const TEMI_CROTONE = [
  'trattativa per Haaland', 'nuovo stadio da 100000 posti',
  'accordo con Mbappe', 'assunzione di Mourinho',
  'Crotone in Champions per errore', 'presidente miliardario arabo',
  'Ronaldo offerto per 50 euro', 'VAR del Crotone e un vecchio con binocolo',
  'Crotone vince Nobel per la difesa', 'fusione con il Napoli',
  'campo sintetico fatto di polenta', 'Crotone candidato ai Mondiali 2030'
];

async function genera() {
  console.log('=== Sarkietta ===');
  console.log('Data:', new Date().toISOString());

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const ts = Date.now();
  const temaCrotone = TEMI_CROTONE[dayOfYear % TEMI_CROTONE.length];

  const [notizie, fanta] = await Promise.all([
    cercaNotizie(),
    Promise.resolve(leggiFantacalcio())
  ]);
  const { calcio: notizieCalcio, f1: notizieF1, moto: notizieMoto, tennis: notizieTennis, crotone: notizieCrotone } = notizie;

  const fantaRiep = fantaRiepilogo(fanta);

  const calcioTesto = notizieCalcio.length > 0
    ? notizieCalcio.map((t,i) => `${i+1}. ${t}`).join('\n')
    : 'Nessuna notizia calcio disponibile.';
  const minoriTesto = [
    ...notizieF1.map(t => 'F1: ' + t),
    ...notizieMoto.map(t => 'MotoGP: ' + t),
    ...notizieTennis.map(t => 'Tennis: ' + t)
  ].join('\n') || 'Nessuna notizia sport minori.';
  const notizieTesto = calcioTesto; // per compatibilità

  // PROMPT SEMPLICE: notizie reali + rielaborazione ironica
  const prompt = `[${ts}] Sei la redazione de "La Sarkietta dello Sport", giornale satirico italiano.
Oggi: ${oggi}

NOTIZIE CALCIO REALI DI OGGI (usa per n1-n6):
${calcioTesto}

NOTIZIE CROTONE REALI da ilrossoblu.it (usale come base per crotone/crotone2/crotone3, rielabora in chiave ironica):
${notizieCrotone.length > 0 ? notizieCrotone.map((t,i) => (i+1)+'. '+t).join('\n') : 'Nessuna notizia Crotone — inventa liberamente sul tema: '+temaCrotone}

NOTIZIE SPORT MINORI REALI (usa ESATTAMENTE per minori_tennis, minori_f1, minori_altro):
${minoriTesto}

FANTACALCIO SARKIASUPERLEGA:
${fantaRiep}

STILE OBBLIGATORIO PER TUTTI I TESTI:
- Tono da opinionista esperto ma emotivo, mai neutrale
- Giudizi netti e posizioni forti, niente vie di mezzo
- Alterna analisi tecnica reale a commenti sarcastici
- Usa ironia, iperboli, esagerazioni
- Inserisci domande retoriche ("ma davvero...?", "dai su...")
- Linguaggio semplice e diretto, occasionali espressioni colorite
- Amplifica sempre il significato degli eventi
- Sfottò e critiche ironiche verso giocatori, arbitri, squadre
- Struttura: apertura con giudizio forte → analisi + sarcasmo → sentenza finale
- VIETATO: tono giornalistico neutro, descrizioni piatte, cronaca senza opinione

ISTRUZIONI TASSATIVE:
- Prendi le notizie reali e rielaborale con lo stile sopra
- Il campo "team" deve essere copiato ESATTAMENTE dalla notizia originale
- NON dedurre team o contesto dalla tua conoscenza — usa SOLO quello che sta scritto
- NON inventare fatti — solo il tono deve essere ironico e opinioso, i fatti restano reali
- Per il Crotone: meta reale meta inventato, tema suggerito: "${temaCrotone}"
- Per fanta_flop e fanta_top: usa i dati reali della classifica
- Nessun apostrofo nei valori JSON
- Max 20 parole per campo (il tono richiede un po' più di spazio)

Rispondi SOLO con JSON:
{"n1":{"titolo":"...","testo":"...","team":"...","badge":"..."},"n2":{"titolo":"...","testo":"...","team":"...","badge":"..."},"n3":{"titolo":"...","testo":"...","team":"...","badge":"..."},"n4":{"titolo":"...","testo":"...","team":"..."},"n5":{"titolo":"...","testo":"...","team":"..."},"n6":{"titolo":"...","testo":"...","team":"..."},"crotone":{"titolo":"...","sottotitolo":"...","testo":"..."},"crotone2":{"titolo":"...","testo":"...","team":"..."},"crotone3":{"titolo":"...","testo":"...","team":"..."},"fanta_flop":{"titolo":"...","testo":"...","squadra":"..."},"fanta_top":{"titolo":"...","testo":"...","squadra":"..."},"fanta_commento":"...","minori_tennis":{"titolo":"...","testo":"..."},"minori_f1":{"titolo":"...","testo":"..."},"minori_altro":{"categoria":"...","titolo":"...","testo":"..."},"ticker":["...","...","...","...","..."],"sondaggio_domanda":"...","sondaggio_opzioni":["...","...","...","..."],"vincenti":[{"nome":"...","testo":"..."},{"nome":"...","testo":"..."}]}`;

  let flat = null;
  for (let t = 1; t <= 3; t++) {
    console.log(`Tentativo ${t}/3...`);
    try {
      const raw = await callDeepSeek(prompt, `Giornalista satirico italiano. ID:${ts}. Giorno:${dayOfYear}. Usa le notizie reali fornite.`);
      console.log('Raw (primi 150):', raw.substring(0, 150));
      flat = JSON.parse(pulisciRaw(raw));
      console.log('JSON OK!');
      break;
    } catch(err) {
      console.log(`Fallito: ${err.message}`);
      if (t < 3) await new Promise(r => setTimeout(r, t * 8000));
    }
  }

  if (!flat) {
    console.log('Fallback contenuti precedenti.');
    if (fs.existsSync(CONTENUTI_FILE)) {
      const prev = JSON.parse(fs.readFileSync(CONTENUTI_FILE, 'utf8'));
      prev.fallback = true;
      prev.generato_il = new Date().toISOString();
      fs.writeFileSync(CONTENUTI_FILE, JSON.stringify(prev, null, 2), 'utf8');
    }
    return;
  }

  // Mappa flat -> struttura contenuti
  const contenuti = {
    generato_il: new Date().toISOString(),
    // Notizie Serie A libere (non vincolate a squadra specifica)
    n1: { titolo: flat.n1.titolo, testo: flat.n1.testo, team: flat.n1.team || 'Calcio', badge: flat.n1.badge || '' },
    n2: { titolo: flat.n2.titolo, testo: flat.n2.testo, team: flat.n2.team || 'Calcio', badge: flat.n2.badge || '' },
    n3: { titolo: flat.n3.titolo, testo: flat.n3.testo, team: flat.n3.team || 'Calcio', badge: flat.n3.badge || '' },
    n4: { titolo: flat.n4.titolo, testo: flat.n4.testo, team: flat.n4.team || 'Calcio' },
    n5: { titolo: flat.n5.titolo, testo: flat.n5.testo, team: flat.n5.team || 'Calcio' },
    n6: { titolo: flat.n6.titolo, testo: flat.n6.testo, team: flat.n6.team || 'Calcio' },
    crotone:  { titolo: flat.crotone.titolo, sottotitolo: flat.crotone.sottotitolo, testo: flat.crotone.testo },
    crotone2: { titolo: flat.crotone2.titolo, testo: flat.crotone2.testo, team: flat.crotone2.team || 'Crotone' },
    crotone3: { titolo: flat.crotone3.titolo, testo: flat.crotone3.testo, team: flat.crotone3.team || 'Crotone' },
    fanta_flop:    { titolo: flat.fanta_flop.titolo, testo: flat.fanta_flop.testo, squadra: flat.fanta_flop.squadra },
    fanta_top:     { titolo: flat.fanta_top.titolo,  testo: flat.fanta_top.testo,  squadra: flat.fanta_top.squadra },
    fanta_commento: flat.fanta_commento,
    minori_tennis: { titolo: flat.minori_tennis.titolo, testo: flat.minori_tennis.testo },
    minori_f1:     { titolo: flat.minori_f1.titolo,     testo: flat.minori_f1.testo },
    minori_altro:  { categoria: flat.minori_altro.categoria, titolo: flat.minori_altro.titolo, testo: flat.minori_altro.testo },
    ticker: [flat.ticker[0], flat.ticker[1], flat.ticker[2], flat.ticker[3], flat.ticker[4]],
    sondaggio_domanda: flat.sondaggio_domanda,
    sondaggio_opzioni: flat.sondaggio_opzioni,
    vincenti: flat.vincenti
  };

  // Narrativa fanta — solo se i dati sono cambiati
  if (fanta) {
    // Controlla se i dati fanta sono cambiati rispetto all'ultimo run
    let narrativaCambiata = true;
    if (fs.existsSync(CONTENUTI_FILE)) {
      const prev = JSON.parse(fs.readFileSync(CONTENUTI_FILE, 'utf8'));
      const prevData = prev.fanta_data;
      if (prevData && prevData.aggiornato_il && fanta.aggiornato_il &&
          prevData.aggiornato_il === fanta.aggiornato_il &&
          prev.fanta_narrativa) {
        narrativaCambiata = false;
        contenuti.fanta_narrativa = prev.fanta_narrativa;
        console.log('Narrativa fanta invariata — riuso precedente (dati Excel non cambiati)');
      }
    }
    if (narrativaCambiata) {
    console.log('\nGenerazione narrativa fanta (dati cambiati)...');
    try {
      const nts = Date.now();
      const np = `Analista sarcastico fantacalcio. Dati: ${fantaRiep}. ID:${nts}.
JSON: {"titolo":"titolo ironico max 8 parole","p1":"frase ironica 25 parole","p2":"frase ironica 25 parole","p3":"frase ironica 25 parole"}
Zero apostrofi nei valori.`;
      const nraw = await callDeepSeek(np, `Satirico. ID:${nts}.`);
      const nj = JSON.parse(pulisciRaw(nraw));
      contenuti.fanta_narrativa = { titolo: nj.titolo, paragrafi: [nj.p1, nj.p2, nj.p3], record: [] };
      console.log('Narrativa OK:', nj.titolo);
    } catch(err) {
      console.log('Narrativa fallita:', err.message);
      if (fs.existsSync(CONTENUTI_FILE)) {
        const prev = JSON.parse(fs.readFileSync(CONTENUTI_FILE, 'utf8'));
        if (prev.fanta_narrativa) contenuti.fanta_narrativa = prev.fanta_narrativa;
      }
    }
    } // fine if narrativaCambiata
    contenuti.fanta_data = fanta;
  }

  fs.writeFileSync(CONTENUTI_FILE, JSON.stringify(contenuti, null, 2), 'utf8');
  fs.writeFileSync(SONDAGGIO_FILE, JSON.stringify({
    domanda: contenuti.sondaggio_domanda,
    opzioni: contenuti.sondaggio_opzioni,
    voti: [0, 0, 0, 0],
    data: new Date().toDateString()
  }, null, 2), 'utf8');

  console.log('\nContenuti salvati:', new Date().toISOString());
}

genera().catch(err => {
  console.error('ERRORE:', err.message);
  process.exit(0);
});
