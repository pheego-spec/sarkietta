<?php
// ─── Voti sondaggio via AJAX ─────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action'])) {

  header('Content-Type: application/json');
  $file = __DIR__ . '/sondaggio.json';

  if ($_GET['action'] === 'vota') {
    $body = json_decode(file_get_contents('php://input'), true);
    $indice = isset($body['indice']) ? intval($body['indice']) : -1;

    if (!file_exists($file)) { echo json_encode(['error' => 'no poll']); exit; }
    $poll = json_decode(file_get_contents($file), true);

    if ($indice < 0 || $indice >= count($poll['voti'])) {
      echo json_encode(['error' => 'indice non valido']); exit;
    }

    $poll['voti'][$indice]++;
    file_put_contents($file, json_encode($poll, JSON_PRETTY_PRINT));
    echo json_encode(['ok' => true, 'voti' => $poll['voti']]);
    exit;
  }

  if ($_GET['action'] === 'sondaggio') {
    if (!file_exists($file)) { echo json_encode(['error' => 'no poll']); exit; }
    echo file_get_contents($file);
    exit;
  }

  echo json_encode(['error' => 'azione sconosciuta']);
  exit;
}

// ─── Leggi contenuti del giorno ──────────────────────────────────────────────
$contenuti_file = __DIR__ . '/contenuti.json';
$contenuti = file_exists($contenuti_file)
  ? json_decode(file_get_contents($contenuti_file), true)
  : null;

$generato_il = '';
if ($contenuti && isset($contenuti['generato_il'])) {
  $dt = new DateTime($contenuti['generato_il']);
  $dt->setTimezone(new DateTimeZone('Europe/Rome'));
  $generato_il = $dt->format('H:i');
}

$giorni = ['Monday'=>'Lunedì','Tuesday'=>'Martedì','Wednesday'=>'Mercoledì',
           'Thursday'=>'Giovedì','Friday'=>'Venerdì','Saturday'=>'Sabato','Sunday'=>'Domenica'];
$mesi   = [1=>'gennaio',2=>'febbraio',3=>'marzo',4=>'aprile',5=>'maggio',6=>'giugno',
           7=>'luglio',8=>'agosto',9=>'settembre',10=>'ottobre',11=>'novembre',12=>'dicembre'];
$now    = new DateTime('now', new DateTimeZone('Europe/Rome'));
$oggi   = ($giorni[$now->format('l')] ?? $now->format('l')) . ' ' .
          intval($now->format('j')) . ' ' .
          ($mesi[intval($now->format('n'))] ?? $now->format('F')) . ' ' .
          $now->format('Y');

function safe($arr, ...$keys) {
  $v = $arr;
  foreach ($keys as $k) {
    if (!is_array($v) || !isset($v[$k])) return '';
    $v = $v[$k];
  }
  return htmlspecialchars($v, ENT_QUOTES, 'UTF-8');
}

function badgeClass($badge) {
  if (strpos($badge, 'Crisi') !== false)   return 'p-red';
  if (strpos($badge, 'Fenomeno') !== false) return 'p-amber';
  if (strpos($badge, 'Bidone') !== false)   return 'p-gray';
  return 'p-green';
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>La Sarkietta dello Sport</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Barlow+Condensed:wght@400;600;700;800&family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--red:#C8102E;--blue:#003087;--border:#ddd}
body{font-family:'Source Serif 4',Georgia,serif;background:#f5f0e8;font-size:16px}
.masthead{background:#fff;border-bottom:3px solid var(--red)}
.top-bar{display:flex;align-items:center;justify-content:space-between;padding:7px 24px;border-bottom:1px solid #eee;flex-wrap:wrap;gap:4px}
.top-bar span{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#888}
.top-bar .date{color:var(--blue);font-weight:700}
.top-bar .edition{color:var(--red);font-weight:700}
.logo-row{display:flex;align-items:center;justify-content:center;padding:18px 24px 12px;gap:24px;border-bottom:1px solid #eee;flex-wrap:wrap}
.logo-divider{width:2px;height:56px;background:var(--red)}
.logo-center{text-align:center}
.logo-center h1{font-family:'Playfair Display',serif;font-size:clamp(34px,7vw,62px);font-weight:900;color:#111;letter-spacing:-1px;line-height:1}
.logo-center h1 em{color:var(--red);font-style:normal}
.logo-center h1 span{color:var(--blue)}
.logo-tagline{font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#aaa;margin-top:4px}
.logo-side{text-align:center;display:flex;flex-direction:column;gap:4px;min-width:80px}
.side-label{font-family:'Barlow Condensed',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#aaa}
.side-val{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:800;color:var(--blue)}
.nav-row{display:flex;overflow-x:auto;background:#fff;border-bottom:2px solid #111}
.nav-row a{display:block;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#555;padding:12px 20px;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;white-space:nowrap;text-decoration:none;transition:color .15s,border-color .15s}
.nav-row a:hover{color:var(--red)}
.nav-row a.active{color:var(--red);border-bottom-color:var(--red)}
.ticker{background:var(--red);color:#fff;padding:7px 0;overflow:hidden;position:relative}
.ticker-label{position:absolute;left:0;top:0;bottom:0;background:#8b0000;padding:0 16px;display:flex;align-items:center;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:800;letter-spacing:2px;z-index:2}
.ticker-track{display:flex;animation:tick 34s linear infinite;padding-left:135px}
.ticker-track span{font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:600;white-space:nowrap;padding:0 36px}
.ticker-track span::before{content:'◆';margin-right:12px;opacity:.6}
@keyframes tick{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.main{padding:20px;max-width:1000px;margin:0 auto}
.tab{display:none}.tab.active{display:block}
.gen-bar{background:#fff;border:1px solid var(--border);border-left:4px solid var(--blue);padding:10px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.gen-dot{width:8px;height:8px;border-radius:50%;background:<?= $contenuti ? '#3b6d11' : '#aaa' ?>;flex-shrink:0}
.gen-text{font-family:'Barlow Condensed',sans-serif;font-size:13px;color:#555;flex:1}
.gen-text strong{color:var(--blue)}
.hero{background:#fff;border:1px solid var(--border);margin-bottom:20px}
.hero-flag{background:var(--red);color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:12px;letter-spacing:3px;text-transform:uppercase;padding:6px 14px;display:inline-block}
.hero-inner{padding:18px 22px 22px}
.hero-kicker{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:var(--blue);letter-spacing:2px;text-transform:uppercase;margin-bottom:7px}
.hero-title{font-family:'Playfair Display',serif;font-size:clamp(22px,4vw,36px);font-weight:900;line-height:1.15;color:#111;margin-bottom:12px}
.hero-text{font-size:16px;line-height:1.7;color:#444}
.hero-meta{font-family:'Barlow Condensed',sans-serif;font-size:13px;color:#aaa;margin-top:12px;border-top:1px solid #f0f0f0;padding-top:10px}
.hero-meta strong{color:var(--red)}
.section-hd{display:flex;align-items:center;gap:12px;margin:22px 0 12px}
.section-hd h2{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#111;white-space:nowrap}
.section-hd .line{flex:1;height:2px;background:var(--blue)}
.section-hd .badge{background:var(--blue);color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;letter-spacing:2px;padding:3px 9px;text-transform:uppercase;white-space:nowrap}
.article-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-bottom:20px}
.acard{background:#fff;border:1px solid var(--border);padding:16px}
.acard .team{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--blue);margin-bottom:5px}
.acard h3{font-family:'Playfair Display',serif;font-size:17px;font-weight:700;line-height:1.3;color:#111;margin-bottom:9px}
.acard p{font-size:14px;line-height:1.6;color:#555}
.acard .meta{font-family:'Barlow Condensed',sans-serif;font-size:11px;color:#bbb;margin-top:10px;border-top:1px solid #f5f5f5;padding-top:8px}
.pill{display:inline-block;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:800;padding:3px 7px;margin-bottom:6px;letter-spacing:1px;text-transform:uppercase}
.p-red{background:#fff0f0;color:#a32d2d;border:1px solid #f09595}
.p-amber{background:#fffbe6;color:#854f0b;border:1px solid #fac775}
.p-gray{background:#f0f0f0;color:#555;border:1px solid #ccc}
.p-green{background:#eaf3de;color:#3b6d11;border:1px solid #97c459}
.fanta-box{background:#111;color:#fff;padding:18px;margin-bottom:20px}
.fanta-title{font-family:'Playfair Display',serif;font-size:22px;font-weight:900;color:#C9962D;margin-bottom:4px}
.fanta-sub{font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:2px;color:#666;text-transform:uppercase;margin-bottom:14px}
.classifica{width:100%;border-collapse:collapse}
.classifica th{font-family:'Barlow Condensed',sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#C9962D;border-bottom:1px solid #333;padding:7px 10px;text-align:left}
.classifica td{padding:9px 10px;border-bottom:1px solid #1a1a1a;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:600}
.pos{font-weight:800;color:#888;width:28px}.p1{color:#C9962D!important}.p2{color:#aaa!important}.p3{color:#CD7F32!important}
.pts{color:#C9962D;font-weight:800}
.sondaggio-wrap{background:#fff;border:1px solid var(--border);border-top:4px solid var(--blue);padding:24px;margin-bottom:20px}
.sond-header{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.sond-header h3{font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--blue)}
.live-dot{width:8px;height:8px;background:var(--red);border-radius:50%;animation:pulse 1.4s infinite;margin-left:auto}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
.sond-q{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#111;margin-bottom:6px;line-height:1.35}
.sond-count{font-family:'Barlow Condensed',sans-serif;font-size:13px;color:#aaa;margin-bottom:18px}
.sond-count strong{color:var(--red)}
.opt{display:block;width:100%;background:#fff;border:1.5px solid #ddd;padding:0;margin-bottom:10px;cursor:pointer;text-align:left;border-radius:3px;overflow:hidden;transition:border-color .15s}
.opt:hover:not([disabled]){border-color:var(--blue)}
.opt[disabled]{cursor:default}
.opt-row{display:flex;align-items:center;gap:12px;padding:11px 14px;position:relative}
.opt-fill{position:absolute;left:0;top:0;bottom:0;background:#e6f1fb;transition:width .6s cubic-bezier(.4,0,.2,1);z-index:0;width:0}
.opt-letter{font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;color:var(--blue);min-width:18px;position:relative;z-index:1}
.opt-text{font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:600;color:#111;flex:1;position:relative;z-index:1}
.opt-pct{font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:800;color:var(--blue);min-width:38px;text-align:right;position:relative;z-index:1}
.opt.is-winner{border-color:var(--red)}.opt.is-winner .opt-fill{background:#fff0f0}.opt.is-winner .opt-letter,.opt.is-winner .opt-pct{color:var(--red)}
.opt.is-mine{border-width:2px;border-color:var(--blue)}.opt.is-mine.is-winner{border-color:var(--red)}
.sond-footer{display:flex;align-items:center;justify-content:space-between;margin-top:8px;flex-wrap:wrap;gap:8px}
.voted-ok{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:var(--red);display:none}
.note{font-family:'Barlow Condensed',sans-serif;font-size:12px;color:#aaa}
.share-btn{background:none;border:1.5px solid var(--border);padding:6px 14px;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;color:var(--blue);border-radius:2px;transition:all .15s}
.share-btn:hover{background:var(--blue);color:#fff;border-color:var(--blue)}
.vincenti-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:20px}
.vincenti-card{background:#fff;border:1px solid var(--border);border-left:4px solid #3b6d11;padding:16px}
.vincenti-card .flag{font-size:22px;margin-bottom:8px;display:block}
.vincenti-card h4{font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#111;margin-bottom:5px}
.vincenti-card p{font-size:13px;color:#666;line-height:1.55}
.minori-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:20px}
.minori-card{background:#fff;border:1px solid var(--border);padding:16px}
.minori-cat{font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#aaa;margin-bottom:6px}
.minori-card h3{font-family:'Playfair Display',serif;font-style:italic;font-size:16px;color:#333;margin-bottom:6px;line-height:1.3}
.minori-card p{font-size:13px;color:#888;line-height:1.5}
.vuoto{background:#fff;border:1px solid var(--border);padding:30px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:14px;color:#aaa}
.footer{background:#111;color:#666;text-align:center;padding:22px;font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:1px;border-top:3px solid var(--red);margin-top:10px}
.footer em{color:var(--red);font-style:normal}
</style>
</head>
<body>

<div class="masthead">
  <div class="top-bar">
    <span class="edition">Edizione Straordinaria</span>
    <span class="date"><?= $oggi ?></span>
    <span>Fondato nel gruppo WhatsApp</span>
  </div>
  <div class="logo-row">
    <div class="logo-side">
      <span class="side-label">Articoli oggi</span>
      <span class="side-val">12</span>
      <span class="side-label" style="margin-top:6px">Verità</span>
      <span class="side-val" style="color:var(--red)">0%</span>
    </div>
    <div class="logo-divider"></div>
    <div class="logo-center">
      <h1>La <em>Sarkietta</em> <span>dello Sport</span></h1>
      <div class="logo-tagline">L'informazione sportiva che non avresti voluto leggere</div>
    </div>
    <div class="logo-divider"></div>
    <div class="logo-side">
      <span class="side-label">Crotone in</span>
      <span class="side-val">Serie D</span>
      <span class="side-label" style="margin-top:6px">Titoli vinti</span>
      <span class="side-val">0</span>
    </div>
  </div>
  <nav class="nav-row">
    <a href="#" class="active" onclick="goTab('home',this);return false">Home</a>
    <a href="#" onclick="goTab('crotone',this);return false">Crotone FC</a>
    <a href="#" onclick="goTab('seriea',this);return false">Serie A</a>
    <a href="#" onclick="goTab('fanta',this);return false">Sarkiasuperlega</a>
    <a href="#" onclick="goTab('minori',this);return false">Sport Minori</a>
  </nav>
</div>

<?php
// Ticker
$ticker_items = [];
if ($contenuti && !empty($contenuti['ticker'])) {
  $ticker_items = $contenuti['ticker'];
} else {
  $ticker_items = [
    'Crotone tratta Haaland: ha chiesto solo di vedere il mare',
    'VAR ammette: guardavo TikTok durante Inter-Milan',
    'Mourinho chiede la panchina del Crotone: voglio sfide vere',
    'Sinner vince ancora — i calciatori chiedono come si fa',
    'Fantacalcio: portiere da 15 crediti fa voto 4'
  ];
}
$ticker_doubled = array_merge($ticker_items, $ticker_items);
?>
<div class="ticker">
  <div class="ticker-label">BREAKING</div>
  <div class="ticker-track">
    <?php foreach ($ticker_doubled as $t): ?>
      <span><?= htmlspecialchars($t, ENT_QUOTES, 'UTF-8') ?></span>
    <?php endforeach; ?>
  </div>
</div>

<div class="main">

<!-- HOME -->
<div id="tab-home" class="tab active">

  <div class="gen-bar">
    <div class="gen-dot"></div>
    <div class="gen-text">
      <?php if ($contenuti && $generato_il): ?>
        Contenuti generati automaticamente oggi alle <strong><?= $generato_il ?></strong> · prossimo aggiornamento domani alle 06:00
      <?php else: ?>
        Contenuti in attesa di generazione — verranno aggiornati automaticamente alle 06:00
      <?php endif; ?>
    </div>
  </div>

  <!-- Hero Crotone -->
  <?php if ($contenuti && !empty($contenuti['crotone'])): $c = $contenuti['crotone']; ?>
  <div class="hero">
    <span class="hero-flag">Crotone — Notizia Epocale</span>
    <div class="hero-inner">
      <div class="hero-kicker"><?= safe($c, 'sottotitolo') ?></div>
      <div class="hero-title"><?= safe($c, 'titolo') ?></div>
      <div class="hero-text"><?= safe($c, 'testo') ?></div>
      <div class="hero-meta">Di Corrispondente Speciale · Generato alle <?= $generato_il ?> · <strong>Notizia del giorno</strong></div>
    </div>
  </div>
  <?php else: ?>
  <div class="vuoto">Contenuti in arrivo alle 06:00 di domani mattina.</div>
  <?php endif; ?>

  <!-- Serie A -->
  <div class="section-hd"><h2>Serie A</h2><div class="line"></div><span class="badge">Ultime ore</span></div>
  <div class="article-grid">
    <?php foreach (['milan' => 'AC Milan', 'juve' => 'Juventus FC', 'inter' => 'Inter Milan'] as $key => $nome):
      $art = $contenuti[$key] ?? null; ?>
    <div class="acard">
      <?php if ($art): ?>
        <span class="pill <?= badgeClass($art['badge'] ?? '') ?>"><?= safe($art, 'badge') ?></span>
        <div class="team"><?= $nome ?></div>
        <h3><?= safe($art, 'titolo') ?></h3>
        <p><?= safe($art, 'testo') ?></p>
        <div class="meta">Generato oggi</div>
      <?php else: ?>
        <div class="team"><?= $nome ?></div>
        <h3 style="color:#aaa">Notizie in arrivo...</h3>
      <?php endif; ?>
    </div>
    <?php endforeach; ?>
  </div>

  <!-- Sondaggio -->
  <div class="section-hd"><h2>Sondaggio del Giorno</h2><div class="line"></div></div>
  <div class="sondaggio-wrap">
    <div class="sond-header"><h3>Vota Ora</h3><div class="live-dot"></div></div>
    <?php
    $poll_file = __DIR__ . '/sondaggio.json';
    $poll = file_exists($poll_file) ? json_decode(file_get_contents($poll_file), true) : null;
    $poll_domanda = $poll ? $poll['domanda'] : 'Chi è la vera rovina del calcio italiano?';
    $poll_opzioni = $poll ? $poll['opzioni'] : ['Il VAR','I procuratori','Il Crotone (con affetto)','Tutti noi'];
    $poll_voti    = $poll ? $poll['voti'] : [0,0,0,0];
    ?>
    <div class="sond-q"><?= htmlspecialchars($poll_domanda) ?></div>
    <div class="sond-count" id="sc"></div>
    <div id="opts-wrap"></div>
    <div class="sond-footer">
      <span class="voted-ok" id="voted-ok">Voto registrato!</span>
      <span class="note">Si resetta ogni mattina alle 06:00</span>
      <button class="share-btn" onclick="share()">Condividi su WhatsApp</button>
    </div>
  </div>

  <!-- Italiani Vincenti -->
  <?php if ($contenuti && !empty($contenuti['vincenti'])): ?>
  <div class="section-hd"><h2>Italiani Vincenti</h2><div class="line"></div></div>
  <div class="vincenti-grid">
    <?php foreach ($contenuti['vincenti'] as $v): ?>
    <div class="vincenti-card">
      <span class="flag">🇮🇹</span>
      <h4><?= safe($v, 'nome') ?></h4>
      <p><?= safe($v, 'testo') ?></p>
    </div>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>

</div><!-- /home -->

<!-- CROTONE -->
<div id="tab-crotone" class="tab">
  <div class="section-hd"><h2>Crotone FC</h2><div class="line"></div><span class="badge" style="background:var(--red)">Notizie Epocali</span></div>
  <div class="article-grid">
    <?php if ($contenuti && !empty($contenuti['crotone'])): $c = $contenuti['crotone']; ?>
    <div class="acard" style="border-top:3px solid var(--red)">
      <div class="team"><?= safe($c, 'sottotitolo') ?></div>
      <h3><?= safe($c, 'titolo') ?></h3>
      <p><?= safe($c, 'testo') ?></p>
      <div class="meta">Generato oggi alle <?= $generato_il ?></div>
    </div>
    <?php endif; ?>
    <div class="acard"><div class="team">Mercato</div><h3>Nuovo allenatore: era il secondo portiere della Reggina nel 1997, ma ha "tanto carattere"</h3><p>Il ds lo descrive come profilo europeo. Parla solo dialetto stretto, si fa capire coi gesti.</p><div class="meta">2 giorni fa</div></div>
    <div class="acard"><div class="team">Infrastrutture</div><h3>Stadio Pitagora: rendering mostra piscina olimpionica e campo da golf. "I fondi arriveranno"</h3><p>Progetto da 180 milioni. Per ora esiste solo il rendering fatto su Canva in 20 minuti.</p><div class="meta">3 giorni fa</div></div>
  </div>
</div>

<!-- SERIE A -->
<div id="tab-seriea" class="tab">
  <div class="section-hd"><h2>Serie A</h2><div class="line"></div><span class="badge">Aggiornamenti</span></div>
  <div class="article-grid">
    <?php foreach (['milan' => 'AC Milan', 'juve' => 'Juventus FC', 'inter' => 'Inter Milan',
                    'seriea_extra' => null, 'seriea_extra2' => null] as $key => $nome):
      $art = $contenuti[$key] ?? null;
      if (!$art) continue;
      $team = $nome ?: ($art['team'] ?? 'Serie A');
    ?>
    <div class="acard">
      <?php if (!empty($art['badge'])): ?>
        <span class="pill <?= badgeClass($art['badge']) ?>"><?= safe($art, 'badge') ?></span>
      <?php endif; ?>
      <div class="team"><?= htmlspecialchars($team) ?></div>
      <h3><?= safe($art, 'titolo') ?></h3>
      <p><?= safe($art, 'testo') ?></p>
      <div class="meta">Generato oggi</div>
    </div>
    <?php endforeach; ?>
  </div>
</div>

<!-- FANTA -->
<div id="tab-fanta" class="tab">
  <div class="section-hd"><h2>Sarkiasuperlega</h2><div class="line"></div></div>
  <?php
  $fanta_file = __DIR__ . '/fantacalcio.json';
  $fanta = file_exists($fanta_file) ? json_decode(file_get_contents($fanta_file), true) : null;
  $pos_classes = ['p1','p2','p3','','','','',''];
  ?>
  <div class="fanta-box">
    <div class="fanta-title">Classifica Generale</div>
    <div class="fanta-sub"><?= $fanta ? htmlspecialchars($fanta['giornata'] ?? '') : 'Nessuna classifica ancora' ?></div>
    <table class="classifica">
      <thead><tr><th>Pos</th><th>Squadra</th><th>Manager</th><th>Pt</th></tr></thead>
      <tbody>
      <?php if ($fanta && !empty($fanta['squadre'])):
        usort($fanta['squadre'], fn($a,$b) => $b['punti'] - $a['punti']);
        foreach ($fanta['squadre'] as $i => $s): ?>
        <tr>
          <td class="pos <?= $pos_classes[$i] ?? '' ?>"><?= $i+1 ?></td>
          <td><?= htmlspecialchars($s['squadra']) ?></td>
          <td><?= htmlspecialchars($s['manager']) ?></td>
          <td class="pts"><?= intval($s['punti']) ?></td>
        </tr>
        <?php endforeach;
      else: ?>
        <tr><td colspan="4" style="color:#555;font-family:'Barlow Condensed',sans-serif;font-size:13px;padding:16px 10px">Aggiorna la classifica via API o modifica fantacalcio.json</td></tr>
      <?php endif; ?>
      </tbody>
    </table>
  </div>
  <div class="section-hd"><h2>Notizie Fantacalcio</h2><div class="line"></div></div>
  <div class="article-grid">
    <div class="acard">
      <span class="pill p-red">Flop Epico</span>
      <div class="team">Giornata</div>
      <h3><?= $contenuti ? safe($contenuti['fanta_flop'] ?? [], 'titolo') : 'Dati in arrivo...' ?></h3>
      <p><?= $contenuti ? safe($contenuti['fanta_flop'] ?? [], 'testo') : '' ?></p>
      <div class="meta">Fantadrammi</div>
    </div>
    <div class="acard">
      <span class="pill p-green">Top Scorer</span>
      <div class="team">Giornata</div>
      <h3><?= $contenuti ? safe($contenuti['fanta_top'] ?? [], 'titolo') : 'Dati in arrivo...' ?></h3>
      <p><?= $contenuti ? safe($contenuti['fanta_top'] ?? [], 'testo') : '' ?></p>
      <div class="meta">Giornata</div>
    </div>
  </div>
</div>

<!-- SPORT MINORI -->
<div id="tab-minori" class="tab">
  <div class="section-hd"><h2>Sport Minori</h2><div class="line"></div><span class="badge" style="background:#555">Con rispetto</span></div>
  <p style="font-size:14px;color:#888;font-style:italic;margin-bottom:16px">Questi sport esistono e li rispettiamo. Tipo come si rispetta il prezzemolo.</p>
  <div class="minori-grid">
    <?php
    $minori = [
      'minori_tennis' => 'Tennis',
      'minori_f1'     => 'Formula 1',
      'minori_altro'  => null
    ];
    foreach ($minori as $key => $cat):
      $art = $contenuti[$key] ?? null;
      $label = $cat ?: ($art['categoria'] ?? 'Altro');
    ?>
    <div class="minori-card">
      <div class="minori-cat"><?= htmlspecialchars($label) ?></div>
      <h3><?= $art ? safe($art, 'titolo') : 'In arrivo...' ?></h3>
      <p><?= $art ? safe($art, 'testo') : '' ?></p>
    </div>
    <?php endforeach; ?>
  </div>
</div>

</div><!-- /main -->
<div class="footer">La <em>Sarkietta</em> dello Sport — Satira & Fantacalcio — Tutti i diritti rivendicati col VAR</div>

<script>
function goTab(name, el) {
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
  document.querySelectorAll('.nav-row a').forEach(function(a){ a.classList.remove('active'); });
  document.getElementById('tab-'+name).classList.add('active');
  el.classList.add('active');
}

// ─── Sondaggio ───────────────────────────────────────────────────────────────
var OPZIONI = <?= json_encode($poll_opzioni) ?>;
var LETTERS = ['A','B','C','D'];
var STORE   = 'sark_v3_' + <?= json_encode($poll_domanda) ?>.slice(0,20);

function loadMyVote() {
  try { var s = JSON.parse(localStorage.getItem(STORE)); return s ? s.myVote : null; } catch(e) { return null; }
}
function saveMyVote(idx) {
  try { localStorage.setItem(STORE, JSON.stringify({myVote:idx})); } catch(e) {}
}
function total(v) { return v.reduce(function(a,b){ return a+b; },0); }
function pct(v,t)  { return t===0 ? 0 : Math.round(v/t*100); }

function renderPoll(votes, myVote) {
  var t = total(votes);
  var winIdx = votes.indexOf(Math.max.apply(null,votes));
  var voted  = myVote !== null && myVote !== undefined;
  document.getElementById('sc').innerHTML = t === 0
    ? 'Nessun voto ancora. Sii il primo!'
    : '<strong>'+t+'</strong> '+(t===1?'voto':'voti')+' totali';
  var wrap = document.getElementById('opts-wrap');
  wrap.innerHTML = '';
  OPZIONI.forEach(function(testo, i) {
    var p = pct(votes[i], t);
    var isWinner = voted && t > 0 && i === winIdx;
    var isMine   = voted && i === myVote;
    var btn = document.createElement('button');
    btn.className = 'opt'+(isMine?' is-mine':'')+(isWinner?' is-winner':'');
    if (voted) btn.setAttribute('disabled','true');
    var fill = document.createElement('div');
    fill.className = 'opt-fill'; fill.style.width = '0%';
    var row = document.createElement('div');
    row.className = 'opt-row';
    row.innerHTML = '<span class="opt-letter">'+LETTERS[i]+'</span>'
      +'<span class="opt-text">'+testo+'</span>'
      +'<span class="opt-pct">'+(voted ? p+'%' : '')+'</span>';
    btn.appendChild(fill); btn.appendChild(row);
    if (!voted) { (function(idx){ btn.onclick = function(){ vota(idx); }; })(i); }
    wrap.appendChild(btn);
    if (voted) setTimeout(function(){ fill.style.width = p+'%'; }, 30);
  });
  if (voted) document.getElementById('voted-ok').style.display = 'inline';
}

function vota(idx) {
  fetch('?action=vota', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({indice: idx})
  })
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (d.ok) { saveMyVote(idx); renderPoll(d.voti, idx); }
  })
  .catch(function(e){ console.error(e); });
}

function share() {
  var q = <?= json_encode($poll_domanda) ?>;
  var msg = 'Sondaggio La Sarkietta: "'+q+'" — vota anche tu!';
  if (navigator.clipboard) navigator.clipboard.writeText(msg).then(function(){ alert('Copiato!'); });
  else alert(msg);
}

// Carica voti attuali dal server all'apertura
fetch('?action=sondaggio')
  .then(function(r){ return r.json(); })
  .then(function(d) {
    var myVote = loadMyVote();
    renderPoll(d.voti, myVote);
  })
  .catch(function(){ renderPoll([0,0,0,0], null); });
</script>
</body>
</html>
