<?php
// ─── Voti sondaggio via AJAX ─────────────────────────────────────────────────
// API sondaggio gestita da api.php

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
<link rel="icon" type="image/png" sizes="32x32" href="favicon.png">
<link rel="icon" type="image/x-icon" href="favicon.ico">
<link rel="shortcut icon" href="favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--red:#C8102E;--blue:#003087;--border:#ddd}
body{font-family:'DM Sans',sans-serif;background:#fff;font-size:16px}
.masthead{background:#fff;border-bottom:3px solid var(--red)}
.top-bar{display:flex;align-items:center;justify-content:space-between;padding:7px 24px;border-bottom:1px solid #eee;flex-wrap:wrap;gap:4px}
.top-bar span{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#888}
.top-bar .date{color:var(--blue);font-weight:700}
.top-bar .edition{color:var(--red);font-weight:700}
.logo-row{display:flex;align-items:center;justify-content:center;padding:18px 24px 12px;gap:24px;border-bottom:1px solid #eee;flex-wrap:wrap}
.logo-divider{width:2px;height:56px;background:var(--red)}
.logo-center{text-align:center}
.logo-center h1{font-family:'DM Serif Display',serif;font-size:clamp(34px,7vw,62px);font-weight:900;color:#111;letter-spacing:-1px;line-height:1}
.logo-center h1 em{color:var(--red);font-style:normal}
.logo-center h1 span{color:var(--blue)}
.logo-tagline{font-family:'DM Sans',sans-serif;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#aaa;margin-top:4px}
.logo-side{text-align:center;display:flex;flex-direction:column;gap:4px;min-width:80px}
.logo-icon{height:clamp(48px,7vw,72px);width:auto;opacity:.9}
@media(max-width:600px){
  .logo-icon{display:none}
  .logo-divider{display:none}
  .logo-row{padding:12px 16px 10px;gap:0}
  .logo-center h1{font-size:clamp(26px,8vw,40px)}
  .logo-tagline{font-size:11px;letter-spacing:2px}
  .top-bar{padding:5px 12px;font-size:11px}
  .top-bar span:first-child,.top-bar span:last-child{display:none}
  .nav-row a{padding:10px 12px;font-size:13px}
  .main{padding:12px}
  .hero-inner{padding:12px 14px 16px}
  .hero-title{font-size:clamp(20px,5vw,28px)}
  .article-grid{grid-template-columns:1fr;gap:10px}
  .vincenti-grid,.minori-grid{grid-template-columns:1fr}
  .ticker-track span{font-size:12px;padding:0 20px}
  .section-hd h2{font-size:16px}
}
.side-label{font-family:'DM Sans',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#aaa}
.side-val{font-family:'DM Sans',sans-serif;font-size:18px;font-weight:800;color:var(--blue)}
.nav-row{display:flex;overflow-x:auto;background:#fff;border-bottom:2px solid #111}
.nav-row a{display:block;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#555;padding:12px 20px;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;white-space:nowrap;text-decoration:none;transition:color .15s,border-color .15s}
.nav-row a:hover{color:var(--red)}
.nav-row a.active{color:var(--red);border-bottom-color:var(--red)}
.ticker{background:var(--red);color:#fff;padding:7px 0;overflow:hidden;position:relative}
.ticker-label{position:absolute;left:0;top:0;bottom:0;background:#8b0000;padding:0 16px;display:flex;align-items:center;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:800;letter-spacing:2px;z-index:2}
.ticker-track{display:flex;animation:tick 34s linear infinite;padding-left:135px}
.ticker-track span{font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;white-space:nowrap;padding:0 36px}
.ticker-track span::before{content:'◆';margin-right:12px;opacity:.6}
@keyframes tick{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.main{padding:20px;max-width:1000px;margin:0 auto;min-height:80vh;background:#fff}
.tab{display:none}.tab.active{display:block}
.gen-bar{background:#fff;border:1px solid var(--border);border-left:4px solid var(--blue);padding:10px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.gen-dot{width:8px;height:8px;border-radius:50%;background:<?= $contenuti ? '#3b6d11' : '#aaa' ?>;flex-shrink:0}
.gen-text{font-family:'DM Sans',sans-serif;font-size:13px;color:#555;flex:1}
.gen-text strong{color:var(--blue)}
.hero{background:#fff;border:1px solid var(--border);margin-bottom:20px}
.hero-flag{background:var(--red);color:#fff;font-family:'DM Sans',sans-serif;font-weight:800;font-size:12px;letter-spacing:3px;text-transform:uppercase;padding:6px 14px;display:inline-block}
.hero-inner{padding:18px 22px 22px}
.hero-kicker{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;color:var(--blue);letter-spacing:2px;text-transform:uppercase;margin-bottom:7px}
.hero-title{font-family:'DM Serif Display',serif;font-size:clamp(22px,4vw,36px);font-weight:900;line-height:1.15;color:#111;margin-bottom:12px}
.hero-text{font-size:16px;line-height:1.7;color:#444}
.hero-meta{font-family:'DM Sans',sans-serif;font-size:13px;color:#aaa;margin-top:12px;border-top:1px solid #f0f0f0;padding-top:10px}
.hero-meta strong{color:var(--red)}
.section-hd{display:flex;align-items:center;gap:12px;margin:22px 0 12px}
.section-hd h2{font-family:'DM Sans',sans-serif;font-size:20px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#111;white-space:nowrap}
.section-hd .line{flex:1;height:2px;background:var(--blue)}
.section-hd .badge{background:var(--blue);color:#fff;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:800;letter-spacing:2px;padding:3px 9px;text-transform:uppercase;white-space:nowrap}
.article-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-bottom:20px}
.acard{background:#fff;border:1px solid var(--border);padding:16px}
.acard .team{font-family:'DM Sans',sans-serif;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--blue);margin-bottom:5px}
.acard h3{font-family:'DM Serif Display',serif;font-size:17px;font-weight:700;line-height:1.3;color:#111;margin-bottom:9px}
.acard p{font-size:14px;line-height:1.6;color:#555}
.acard .meta{font-family:'DM Sans',sans-serif;font-size:11px;color:#bbb;margin-top:10px;border-top:1px solid #f5f5f5;padding-top:8px}
.pill{display:inline-block;font-family:'DM Sans',sans-serif;font-size:10px;font-weight:800;padding:3px 7px;margin-bottom:6px;letter-spacing:1px;text-transform:uppercase}
.p-red{background:#fff0f0;color:#a32d2d;border:1px solid #f09595}
.p-amber{background:#fffbe6;color:#854f0b;border:1px solid #fac775}
.p-gray{background:#f0f0f0;color:#555;border:1px solid #ccc}
.p-green{background:#eaf3de;color:#3b6d11;border:1px solid #97c459}
.fanta-box{background:#fff;color:#111;border:1px solid var(--border);border-top:4px solid var(--blue);padding:18px;margin-bottom:20px}
.fanta-title{font-family:'DM Serif Display',serif;font-size:22px;font-weight:900;color:var(--blue);margin-bottom:4px}
.fanta-sub{font-family:'DM Sans',sans-serif;font-size:11px;letter-spacing:2px;color:#888;text-transform:uppercase;margin-bottom:14px}
.classifica{width:100%;border-collapse:collapse}
.classifica th{font-family:'DM Sans',sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--blue);border-bottom:2px solid var(--blue);padding:7px 10px;text-align:left}
.classifica td{padding:9px 10px;border-bottom:1px solid #eee;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;color:#111}
.pos{font-weight:700;color:#888;width:28px}.p1{color:var(--red)!important}.p2{color:#888!important}.p3{color:#b5651d!important}
.pts{color:var(--blue);font-weight:700}
.sondaggio-wrap{background:#fff;border:1px solid var(--border);border-top:4px solid var(--blue);padding:24px;margin-bottom:20px}
.sond-header{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.sond-header h3{font-family:'DM Sans',sans-serif;font-size:15px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--blue)}
.live-dot{width:8px;height:8px;background:var(--red);border-radius:50%;animation:pulse 1.4s infinite;margin-left:auto}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
.sond-q{font-family:'DM Serif Display',serif;font-size:20px;font-weight:700;color:#111;margin-bottom:6px;line-height:1.35}
.sond-count{font-family:'DM Sans',sans-serif;font-size:13px;color:#aaa;margin-bottom:18px}
.sond-count strong{color:var(--red)}
.opt{display:block;width:100%;background:#fff;border:1.5px solid #ddd;padding:0;margin-bottom:10px;cursor:pointer;text-align:left;border-radius:3px;overflow:hidden;transition:border-color .15s;user-select:none;position:relative}
.opt:hover:not(.opt-voted){border-color:var(--blue)}
.opt.opt-voted{cursor:default}
.opt-row{display:flex;align-items:center;gap:12px;padding:11px 14px;position:relative}
.opt-fill{position:absolute;left:0;top:0;bottom:0;background:#e6f1fb;transition:width .6s cubic-bezier(.4,0,.2,1);z-index:0;width:0;max-width:100%}
.opt-letter{font-family:'DM Sans',sans-serif;font-size:15px;font-weight:800;color:var(--blue);min-width:18px;position:relative;z-index:1}
.opt-text{font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;color:#111;flex:1;position:relative;z-index:1}
.opt-pct{font-family:'DM Sans',sans-serif;font-size:15px;font-weight:800;color:var(--blue);min-width:38px;text-align:right;position:relative;z-index:1}
.opt.is-winner{border-color:var(--red)}.opt.is-winner .opt-fill{background:#fff0f0}.opt.is-winner .opt-letter,.opt.is-winner .opt-pct{color:var(--red)}
.opt.is-mine{border-width:2px;border-color:var(--blue)}.opt.is-mine.is-winner{border-color:var(--red)}
.sond-footer{display:flex;align-items:center;justify-content:space-between;margin-top:8px;flex-wrap:wrap;gap:8px}
.voted-ok{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;color:var(--red);display:none}
.note{font-family:'DM Sans',sans-serif;font-size:12px;color:#aaa}
.share-btn{background:none;border:1.5px solid var(--border);padding:6px 14px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;color:var(--blue);border-radius:2px;transition:all .15s}
.share-btn:hover{background:var(--blue);color:#fff;border-color:var(--blue)}
.vincenti-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:20px}
.vincenti-card{background:#fff;border:1px solid var(--border);border-left:4px solid #3b6d11;padding:16px}
.vincenti-card .flag{font-size:22px;margin-bottom:8px;display:block}
.vincenti-card h4{font-family:'DM Serif Display',serif;font-size:17px;font-weight:700;color:#111;margin-bottom:5px}
.vincenti-card p{font-size:13px;color:#666;line-height:1.55}
.minori-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:20px}
.minori-card{background:#fff;border:1px solid var(--border);padding:16px}
.minori-cat{font-family:'DM Sans',sans-serif;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#aaa;margin-bottom:6px}
.minori-card h3{font-family:'DM Serif Display',serif;font-style:italic;font-size:16px;color:#333;margin-bottom:6px;line-height:1.3}
.minori-card p{font-size:13px;color:#888;line-height:1.5}
.vuoto{background:#fff;border:1px solid var(--border);padding:30px;text-align:center;font-family:'DM Sans',sans-serif;font-size:14px;color:#aaa}
.footer{background:#111;color:#666;text-align:center;padding:22px;font-family:'DM Sans',sans-serif;font-size:13px;letter-spacing:1px;border-top:3px solid var(--red);margin-top:10px}
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
    <img src="icona.png" alt="" class="logo-icon">
    <div class="logo-divider"></div>
    <div class="logo-center">
      <h1>La <em>Sarkietta</em> <span>dello Sport</span></h1>
      <div class="logo-tagline">L'informazione sportiva che non avresti voluto leggere</div>
    </div>
    <div class="logo-divider"></div>
    <img src="icona.png" alt="" class="logo-icon">
  </div>
  <nav class="nav-row">
    <a href="#" class="active" onclick="goTab('home',this);return false">Home</a>
    <a href="#" onclick="goTab('fanta',this);return false">Sarkiasuperlega</a>
    <a href="#" onclick="goTab('crotone',this);return false">Crotone FC</a>
    <a href="#" onclick="goTab('seriea',this);return false">Serie A</a>
    <a href="#" onclick="goTab('minori',this);return false">Sport Minori</a>
    <a href="#" onclick="goTab('sondaggio',this);return false">Sondaggio</a>
    <a href="#" onclick="goTab('giovanni',this);return false">Giovanni spiega</a>
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
    <?php foreach (['n1','n2','n3'] as $key):
      $art = $contenuti[$key] ?? null;
      if (!$art) continue; ?>
    <div class="acard">
      <span class="pill <?= badgeClass($art['badge'] ?? '') ?>"><?= safe($art, 'badge') ?></span>
      <div class="team"><?= safe($art, 'team') ?></div>
      <h3><?= safe($art, 'titolo') ?></h3>
      <p><?= safe($art, 'testo') ?></p>
      <div class="meta">Generato oggi</div>
    </div>
    <?php endforeach; ?>
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
    <?php if ($contenuti && !empty($contenuti['crotone2'])): ?>
    <div class="acard">
      <div class="team"><?= safe($contenuti['crotone2'], 'team') ?></div>
      <h3><?= safe($contenuti['crotone2'], 'titolo') ?></h3>
      <p><?= safe($contenuti['crotone2'], 'testo') ?></p>
      <div class="meta">Generato oggi</div>
    </div>
    <?php endif; ?>
    <?php if ($contenuti && !empty($contenuti['crotone3'])): ?>
    <div class="acard">
      <div class="team"><?= safe($contenuti['crotone3'], 'team') ?></div>
      <h3><?= safe($contenuti['crotone3'], 'titolo') ?></h3>
      <p><?= safe($contenuti['crotone3'], 'testo') ?></p>
      <div class="meta">Generato oggi</div>
    </div>
    <?php endif; ?>
  </div>
</div>

<!-- SERIE A -->
<div id="tab-seriea" class="tab">
  <div class="section-hd"><h2>Serie A e Calcio</h2><div class="line"></div><span class="badge">Aggiornamenti</span></div>
  <div class="article-grid">
    <?php foreach (['n1','n2','n3','n4','n5','n6'] as $key):
      $art = $contenuti[$key] ?? null;
      if (!$art) continue; ?>
    <div class="acard">
      <?php if (!empty($art['badge'])): ?>
        <span class="pill <?= badgeClass($art['badge']) ?>"><?= safe($art, 'badge') ?></span>
      <?php endif; ?>
      <div class="team"><?= safe($art, 'team') ?></div>
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
  $fanta = null;
  if ($contenuti && !empty($contenuti['fanta_data'])) {
    $fanta = $contenuti['fanta_data'];
  } else {
    $fanta_file = __DIR__ . '/fantacalcio.json';
    $fanta = file_exists($fanta_file) ? json_decode(file_get_contents($fanta_file), true) : null;
  }
  $pos_classes = ['p1','p2','p3','','','','',''];
  ?>

  <?php if ($contenuti && !empty($contenuti['fanta_commento'])): ?>
  <div style="background:#fff;border:1px solid var(--border);border-left:4px solid var(--blue);padding:16px 20px;margin-bottom:20px;">
    <div style="font-family:'DM Sans',sans-serif;font-size:11px;letter-spacing:2px;color:var(--blue);text-transform:uppercase;margin-bottom:6px;font-weight:600">Commento della giornata</div>
    <div style="font-family:'DM Serif Display',serif;font-size:18px;color:#111;line-height:1.4;font-style:italic">"<?= safe($contenuti, 'fanta_commento') ?>"</div>
  </div>
  <?php endif; ?>

  <div class="article-grid" style="margin-bottom:20px">
    <div class="acard">
      <span class="pill p-red">Flop Epico</span>
      <div class="team"><?= $contenuti ? safe($contenuti['fanta_flop'] ?? [], 'squadra') : 'Giornata' ?></div>
      <h3><?= $contenuti ? safe($contenuti['fanta_flop'] ?? [], 'titolo') : 'Dati in arrivo...' ?></h3>
      <p><?= $contenuti ? safe($contenuti['fanta_flop'] ?? [], 'testo') : '' ?></p>
      <div class="meta">Fantadrammi · <?= $fanta ? safe($fanta, 'giornata') : '' ?></div>
    </div>
    <div class="acard">
      <span class="pill p-green">Top della Giornata</span>
      <div class="team"><?= $contenuti ? safe($contenuti['fanta_top'] ?? [], 'squadra') : 'Giornata' ?></div>
      <h3><?= $contenuti ? safe($contenuti['fanta_top'] ?? [], 'titolo') : 'Dati in arrivo...' ?></h3>
      <p><?= $contenuti ? safe($contenuti['fanta_top'] ?? [], 'testo') : '' ?></p>
      <div class="meta">Sarkiasuperlega · <?= $fanta ? safe($fanta, 'giornata') : '' ?></div>
    </div>
  </div>

  <?php
  $narrativa = null;
  if ($contenuti && !empty($contenuti['fanta_narrativa'])) {
    $narrativa = $contenuti['fanta_narrativa'];
  } elseif ($fanta && !empty($fanta['narrativa'])) {
    $narrativa = $fanta['narrativa'];
  }
  ?>
  <?php if ($narrativa): $n = $narrativa; ?>
  <div class="section-hd"><h2>La Situazione</h2><div class="line"></div><span class="badge">Analisi Epica</span></div>
  <div style="background:#fff;border:1px solid var(--border);border-left:4px solid var(--blue);padding:20px;margin-bottom:16px">
    <div style="font-family:'DM Serif Display',serif;font-size:19px;color:#111;margin-bottom:14px;line-height:1.3">
      <?= htmlspecialchars($n['titolo']) ?>
    </div>
    <?php foreach ($n['paragrafi'] as $p): ?>
    <p style="font-size:15px;line-height:1.75;color:#444;margin-bottom:12px"><?= htmlspecialchars($p) ?></p>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>

  <div class="section-hd"><h2>Classifica</h2><div class="line"></div><span class="badge"><?= $fanta ? htmlspecialchars($fanta['giornata'] ?? '') : '' ?></span></div>
  <div class="fanta-box">
    <table class="classifica">
      <thead><tr><th>Pos</th><th>Squadra</th><th>V</th><th>N</th><th>P</th><th>Gf</th><th>Gs</th><th>Pt</th></tr></thead>
      <tbody>
      <?php if ($fanta && !empty($fanta['squadre'])):
        usort($fanta['squadre'], fn($a,$b) => $b['punti'] - $a['punti']);
        foreach ($fanta['squadre'] as $i => $s): ?>
        <tr>
          <td class="pos <?= $pos_classes[$i] ?? '' ?>"><?= $i+1 ?></td>
          <td><?= htmlspecialchars($s['squadra']) ?></td>
          <td><?= intval($s['v'] ?? 0) ?></td>
          <td><?= intval($s['n'] ?? 0) ?></td>
          <td><?= intval($s['p'] ?? 0) ?></td>
          <td><?= intval($s['gf'] ?? 0) ?></td>
          <td><?= intval($s['gs'] ?? 0) ?></td>
          <td class="pts"><?= intval($s['punti']) ?></td>
        </tr>
        <?php endforeach;
      else: ?>
        <tr><td colspan="8" style="font-family:'DM Sans',sans-serif;font-size:13px;padding:16px 10px;color:#888">Carica gli Excel nella cartella fanta/ su GitHub</td></tr>
      <?php endif; ?>
      </tbody>
    </table>
    <?php if ($fanta && !empty($fanta['ultima_giornata']['risultati'])): ?>
    <div style="margin-top:18px;border-top:1px solid #eee;padding-top:14px">
      <div style="font-family:'DM Sans',sans-serif;font-size:11px;letter-spacing:2px;color:#888;text-transform:uppercase;margin-bottom:10px">
        Risultati <?= htmlspecialchars($fanta['ultima_giornata']['numero'] ?? '') ?>ª Giornata
      </div>
      <?php foreach ($fanta['ultima_giornata']['risultati'] as $r): ?>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid #eee;font-family:'DM Sans',sans-serif;font-size:14px">
        <span style="flex:1;color:<?= $r['gol_casa'] > $r['gol_fuori'] ? 'var(--blue)' : '#aaa' ?>;font-weight:<?= $r['gol_casa'] > $r['gol_fuori'] ? '700' : '400' ?>">
          <?= htmlspecialchars($r['casa']) ?>
          <span style="font-size:11px;color:#aaa;margin-left:4px">(<?= number_format($r['pt_casa'] ?? 0, 1) ?>)</span>
        </span>
        <span style="background:var(--blue);padding:3px 12px;font-size:16px;font-weight:700;color:white;margin:0 10px;letter-spacing:2px">
          <?= intval($r['gol_casa']) ?>-<?= intval($r['gol_fuori']) ?>
        </span>
        <span style="flex:1;text-align:right;color:<?= $r['gol_fuori'] > $r['gol_casa'] ? 'var(--blue)' : '#aaa' ?>;font-weight:<?= $r['gol_fuori'] > $r['gol_casa'] ? '700' : '400' ?>">
          <span style="font-size:11px;color:#aaa;margin-right:4px">(<?= number_format($r['pt_fuori'] ?? 0, 1) ?>)</span>
          <?= htmlspecialchars($r['fuori']) ?>
        </span>
      </div>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>
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

<!-- SONDAGGIO -->
<div id="tab-sondaggio" class="tab" style="background:#fff">
  <div class="section-hd"><h2>Sondaggio del Giorno</h2><div class="line"></div></div>
  <?php
  $poll_file = __DIR__ . '/sondaggio.json';
  $poll = file_exists($poll_file) ? json_decode(file_get_contents($poll_file), true) : null;
  $poll_domanda = $poll ? $poll['domanda'] : 'Chi è la vera rovina del calcio italiano?';
  $poll_opzioni = $poll ? $poll['opzioni'] : ['Il VAR','I procuratori','Il Crotone (con affetto)','Tutti noi'];
  ?>
  <div class="sondaggio-wrap">
    <div class="sond-header"><h3>Vota Ora</h3><div class="live-dot"></div></div>
    <div class="sond-q"><?= htmlspecialchars($poll_domanda) ?></div>
    <div class="sond-count" id="sc"></div>
    <div id="opts-wrap"></div>
    <div class="sond-footer">
      <span class="voted-ok" id="voted-ok" style="display:none">Voto registrato!</span>
      <span class="note">Si resetta ogni mattina alle 06:00</span>
      <button class="share-btn" onclick="share()">Condividi su WhatsApp</button>
    </div>
  </div>
</div>

<!-- GIOVANNI -->
<div id="tab-giovanni" class="tab">
  <?php
  $gio_file = __DIR__ . '/giovanni_articoli.json';
  $gio_articoli = [];
  if (file_exists($gio_file)) {
    $gio_data = json_decode(file_get_contents($gio_file), true);
    $gio_articoli = array_filter(is_array($gio_data) ? $gio_data : [], fn($a) => !empty($a['pubblicato']));
  }
  ?>
  <div class="section-hd"><h2>Giovanni ci spiega lo sport</h2><div class="line"></div></div>
  <div style="font-size:14px;color:#888;font-style:italic;margin-bottom:20px">
    Analisi, teorie e spiegazioni di chi capisce tutto. O quasi.
  </div>
  <?php if (empty($gio_articoli)): ?>
  <div style="background:#fff;border:1px solid #ddd;padding:30px;text-align:center;color:#aaa;font-size:14px">
    Giovanni sta ancora studiando l'argomento. Torna presto.
  </div>
  <?php else: ?>
    <?php foreach ($gio_articoli as $art): ?>
    <div style="background:#fff;border:1px solid #ddd;margin-bottom:16px;padding:22px 24px">
      <div style="font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--blue);margin-bottom:8px">
        <?= htmlspecialchars($art['data'] ?? '') ?>
      </div>
      <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#111;margin-bottom:14px;line-height:1.25">
        <?= htmlspecialchars($art['titolo']) ?>
      </div>
      <div style="font-size:15px;line-height:1.8;color:#444;white-space:pre-wrap"><?= htmlspecialchars($art['testo']) ?></div>
    </div>
    <?php endforeach; ?>
  <?php endif; ?>
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
var OPZIONI = <?= json_encode($poll_opzioni ?? ['Il VAR','I procuratori','Il Crotone (con affetto)','Tutti noi']) ?>;
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
    var el = document.createElement('div');
    el.className = 'opt'+(isMine?' is-mine':'')+(isWinner?' is-winner':'');
    el.style.cursor = voted ? 'default' : 'pointer';
    var fill = document.createElement('div');
    fill.className = 'opt-fill'; fill.style.width = '0%';
    var row = document.createElement('div');
    row.className = 'opt-row';
    row.innerHTML = '<span class="opt-letter">'+LETTERS[i]+'</span>'
      +'<span class="opt-text">'+testo+'</span>'
      +'<span class="opt-pct">'+(voted ? p+'%' : '')+'</span>';
    el.appendChild(fill); el.appendChild(row);
    if (!voted) {
      (function(idx){
        el.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          vota(idx);
        });
      })(i);
    }
    wrap.appendChild(el);
    if (voted) setTimeout(function(){ fill.style.width = p+'%'; }, 30);
  });
  if (voted) document.getElementById('voted-ok').style.display = 'inline';
}

function vota(idx) {
  fetch('/api.php?action=vota', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({indice: idx})
  })
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (d.ok) {
      saveMyVote(idx);
      renderPoll(d.voti, idx);
    }
  })
  .catch(function(e){ console.error('Errore voto:', e); });
  return false;
}

function share() {
  var q = <?= json_encode($poll_domanda) ?>;
  var msg = 'Sondaggio La Sarkietta: "'+q+'" — vota anche tu!';
  if (navigator.clipboard) navigator.clipboard.writeText(msg).then(function(){ alert('Copiato!'); });
  else alert(msg);
}

// Carica voti attuali dal server all'apertura
fetch('/api.php?action=sondaggio')
  .then(function(r){ return r.json(); })
  .then(function(d) {
    var sy = window.scrollY;
    var myVote = loadMyVote();
    renderPoll(d.voti, myVote);
    window.scrollTo(0, sy);
  })
  .catch(function(){
    var sy = window.scrollY;
    renderPoll([0,0,0,0], null);
    window.scrollTo(0, sy);
  });
</script>
</body>
</html>
