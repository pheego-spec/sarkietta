const fs = require('fs');
const path = require('path');

async function genera() {
  console.log('Generazione contenuti con DeepSeek:', new Date().toISOString());

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const prompt = `Sei la redazione de "La Sarkietta dello Sport", giornale satirico italiano per un gruppo di amici 40enni appassionati di calcio e fantacalcio.

Oggi è ${oggi}. Genera i contenuti giornalieri in formato JSON puro, zero markdown, zero backtick.

Rispondi SOLO con questo JSON, nient'altro:

{"crotone":{"titolo":"...","sottotitolo":"...","testo":"..."},"milan":{"titolo":"...","testo":"...","badge":"Crisi Nera"},"juve":{"titolo":"...","testo":"...","badge":"Fenomeno?"},"inter":{"titolo":"...","testo":"...","badge":"Bidone d'Oro"},"seriea_extra":{"titolo":"...","testo":"...","team":"..."},"seriea_extra2":{"titolo":"...","testo":"...","team":"..."},"fanta_flop":{"titolo":"...","testo":"..."},"fanta_top":{"titolo":"...","testo":"..."},"minori_tennis":{"titolo":"...","testo":"..."},"minori_f1":{"titolo":"...","testo":"..."},"minori_altro":{"categoria":"...","titolo":"...","testo":"..."},"ticker":["...","...","...","...","..."],"sondaggio_domanda":"...","sondaggio_opzioni":["...","...","...","..."],"vincenti":[{"nome":"...","testo":"..."},{"nome":"...","testo":"..."}]}

Regole per i testi:
- crotone.titolo: max 15 parole, epocale e assurdo
- crotone.sottotitolo: max 6 parole tipo "Mercato Storico · Champions 2030"
- crotone.testo: max 50 parole
- milan/juve/inter titolo: max 12 parole, testo: max 40 parole
- seriea_extra/extra2 titolo: max 12 parole, testo: max 40 parole
- fanta_flop/top titolo: max 12 parole, testo: max 30 parole
- minori titolo: max 10 parole, testo: max 25 parole
- ticker: 5 frasi di max 8 parole ciascuna
- sondaggio_domanda: max 10 parole
- sondaggio_opzioni: 4 opzioni di max 6 parole ciascuna
- vincenti testo: max 20 parole ironici

Tono: sarcastico intelligente, mai volgare. Crotone sempre protagonista assurdo.`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 4096,
      temperature: 1.0,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  console.log('Tokens usati:', data.usage);

  const raw = data.choices[0].message.content.trim();
  console.log('Risposta raw (primi 200 char):', raw.substring(0, 200));

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

  console.log('Contenuti salvati con successo:', contenuti.generato_il);
}

genera().catch(err => {
  console.error('ERRORE:', err.message);
  process.exit(1);
});
