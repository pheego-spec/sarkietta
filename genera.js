const fs = require('fs');
const path = require('path');

async function genera() {
  console.log('Generazione contenuti con DeepSeek:', new Date().toISOString());

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const prompt = `Sei la redazione de "La Sarkietta dello Sport", giornale satirico italiano per un gruppo di amici 40enni appassionati di calcio e fantacalcio.

Oggi è ${oggi}. Genera i contenuti giornalieri in formato JSON puro, zero markdown, zero backtick.

{
  "crotone": {
    "titolo": "titolo epocale e assurdo su Crotone Calcio",
    "sottotitolo": "kicker tipo 'Mercato Storico · Progetto Champions'",
    "testo": "articolo max 90 parole"
  },
  "milan":  { "titolo": "...", "testo": "max 70 parole", "badge": "Crisi Nera" },
  "juve":   { "titolo": "...", "testo": "max 70 parole", "badge": "Fenomeno?" },
  "inter":  { "titolo": "...", "testo": "max 70 parole", "badge": "Bidone d'Oro" },
  "seriea_extra":  { "titolo": "...", "testo": "max 70 parole", "team": "nome squadra" },
  "seriea_extra2": { "titolo": "...", "testo": "max 70 parole", "team": "nome squadra" },
  "fanta_flop": { "titolo": "giocatore flop con voto basso", "testo": "max 60 parole" },
  "fanta_top":  { "titolo": "top scorer ironico della giornata", "testo": "max 60 parole" },
  "minori_tennis": { "titolo": "tennis visto da tifoso calcio", "testo": "max 50 parole" },
  "minori_f1":     { "titolo": "F1 visto da tifoso calcio", "testo": "max 50 parole" },
  "minori_altro":  { "categoria": "sport", "titolo": "...", "testo": "max 50 parole" },
  "ticker": ["breaking 1","breaking 2","breaking 3","breaking 4","breaking 5"],
  "sondaggio_domanda": "domanda ironica sul calcio italiano",
  "sondaggio_opzioni": ["opzione A","opzione B","opzione C","opzione D"],
  "vincenti": [
    { "nome": "sportivo italiano vincente", "testo": "max 30 parole ironici" },
    { "nome": "altro sportivo italiano",    "testo": "max 30 parole ironici" }
  ]
}

Regole:
- Crotone SEMPRE protagonista di notizie assurde ed epocali
- Tono sarcastico intelligente, mai volgare
- Titoli stile Gazzetta: seri all'inizio, assurdi alla fine
- Running joke: Crotone tratta campioni impossibili, VAR incomprensibile, procuratori in giacca a vento
- Varia ogni giorno, non ripetere le stesse battute

Rispondi SOLO con il JSON valido.`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 2000,
      temperature: 1.0,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const raw = data.choices[0].message.content.trim();
  const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const contenuti = JSON.parse(clean);
  contenuti.generato_il = new Date().toISOString();

  fs.writeFileSync(
    path.join(__dirname, 'public', 'contenuti.json'),
    JSON.stringify(contenuti, null, 2),
    'utf8'
  );

  const sondaggio = {
    domanda: contenuti.sondaggio_domanda,
    opzioni: contenuti.sondaggio_opzioni,
    voti: [0, 0, 0, 0],
    data: new Date().toDateString()
  };
  fs.writeFileSync(
    path.join(__dirname, 'public', 'sondaggio.json'),
    JSON.stringify(sondaggio, null, 2),
    'utf8'
  );

  console.log('Contenuti salvati. Generato il:', contenuti.generato_il);
}

genera().catch(err => {
  console.error('ERRORE:', err.message);
  process.exit(1);
});
