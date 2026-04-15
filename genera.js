const fs = require('fs');
const path = require('path');

async function genera() {
  console.log('Generazione contenuti con DeepSeek:', new Date().toISOString());

  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const prompt = `Sei la redazione de "La Sarkietta dello Sport", giornale satirico italiano.
Oggi è ${oggi}.
Rispondi SOLO con JSON valido, zero markdown, zero backtick, zero testo extra.
Ogni campo testo: MAX 20 parole.

{"crotone":{"titolo":"max 12 parole","sottotitolo":"max 5 parole","testo":"max 20 parole"},"milan":{"titolo":"max 10 parole","testo":"max 20 parole","badge":"Crisi Nera"},"juve":{"titolo":"max 10 parole","testo":"max 20 parole","badge":"Fenomeno?"},"inter":{"titolo":"max 10 parole","testo":"max 20 parole","badge":"Bidone d'Oro"},"seriea_extra":{"titolo":"max 10 parole","testo":"max 20 parole","team":"squadra"},"seriea_extra2":{"titolo":"max 10 parole","testo":"max 20 parole","team":"squadra"},"fanta_flop":{"titolo":"max 10 parole","testo":"max 15 parole"},"fanta_top":{"titolo":"max 10 parole","testo":"max 15 parole"},"minori_tennis":{"titolo":"max 8 parole","testo":"max 15 parole"},"minori_f1":{"titolo":"max 8 parole","testo":"max 15 parole"},"minori_altro":{"categoria":"sport","titolo":"max 8 parole","testo":"max 15 parole"},"ticker":["max 6 parole","max 6 parole","max 6 parole","max 6 parole","max 6 parole"],"sondaggio_domanda":"max 8 parole","sondaggio_opzioni":["max 5 parole","max 5 parole","max 5 parole","max 5 parole"],"vincenti":[{"nome":"nome sportivo","testo":"max 15 parole"},{"nome":"nome sportivo","testo":"max 15 parole"}]}

Sostituisci ogni campo con testo ironico reale. Crotone sempre protagonista assurdo. Tono sarcastico.`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 8192,
      temperature: 1.0,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  console.log('Finish reason:', data.choices[0].finish_reason);
  console.log('Tokens usati:', JSON.stringify(data.usage));

  const raw = data.choices[0].message.content.trim();
  console.log('Lunghezza risposta:', raw.length, 'chars');
  console.log('Primi 300 chars:', raw.substring(0, 300));

  if (data.choices[0].finish_reason !== 'stop') {
    throw new Error(`DeepSeek ha troncato la risposta. Finish reason: ${data.choices[0].finish_reason}. Tokens: ${JSON.stringify(data.usage)}`);
  }

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
