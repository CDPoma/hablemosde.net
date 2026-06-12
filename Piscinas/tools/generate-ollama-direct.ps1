$ErrorActionPreference = 'Stop'
Set-Location "$PSScriptRoot\.."

$feedPath = ".\content\feed.json"
$backupPath = ".\content\feed.backup.ollama-direct.$((Get-Date).ToString('yyyyMMdd-HHmmss')).json"
Copy-Item $feedPath $backupPath -Force
$feed = Get-Content $feedPath -Raw | ConvertFrom-Json

$existingPostSlugs = @($feed.posts | ForEach-Object { $_.slug } | Where-Object { $_ })
$existingNewsSlugs = @($feed.news | ForEach-Object { $_.slug } | Where-Object { $_ })

$today = (Get-Date).ToString('d MMMM yyyy', [Globalization.CultureInfo]::GetCultureInfo('es-ES'))

$prompt = @"
Eres redactor SEO para una web de piscinas en espanol.
Devuelve SOLO JSON valido (sin markdown ni explicaciones), con esta estructura exacta:
{
  "posts": [
    {
      "slug": "...",
      "title": "...",
      "excerpt": "...",
      "category": "Mantenimiento|Problemas|Filtracion|Seguridad|Temporada",
      "date": "$today",
      "author": "Redaccion",
      "content": "..."
    }
  ],
  "news": [
    {
      "slug": "...",
      "title": "...",
      "summary": "...",
      "tag": "Mantenimiento|Problemas|Filtracion|Seguridad|Temporada|Ahorro|Productos|Consejos",
      "date": "$today",
      "content": "..."
    }
  ]
}

Estructura editorial obligatoria:
- Los 10 posts deben estar relacionados entre si y con el mismo nicho.
- Reparte los posts asi: 4 de mismo nicho, 3 de tema cercano, 3 de satelite semantico.
- Los 3 news deben ser de apoyo editorial del mismo nicho, no noticias genericas.
- Usa relaciones semanticas claras: pH, cloro, filtracion, algas, turbidez, seguridad, mantenimiento, temporada y ahorro.
- Evita temas aislados o repetidos sin aporte nuevo.

Requisitos:
- Genera 10 posts y 3 news.
- Slugs unicos, en minusculas y con guiones.
- No uses estos slugs en posts: $($existingPostSlugs -join ', ')
- No uses estos slugs en news: $($existingNewsSlugs -join ', ')
- Cada post con 500-900 palabras aproximadamente.
- Excerpt entre 140 y 190 caracteres.
- Summary entre 110 y 165 caracteres.
- Contenido practico, accionable, sin relleno, orientado a piscina domestica en Espana.
- No incluyas enlaces ni menciones de afiliacion ni Amazon.
- ASCII only (sin caracteres especiales raros).
"@

# Generacion local con Ollama (sin usar tokens de chat)
$raw = ollama run hermes3:latest $prompt
if (-not $raw) { throw "Ollama no devolvio contenido" }

# Intentar parse directo; si falla, extraer bloque JSON principal
$jsonText = $raw
try {
  $generated = $jsonText | ConvertFrom-Json
} catch {
  $start = $jsonText.IndexOf('{')
  $end = $jsonText.LastIndexOf('}')
  if ($start -ge 0 -and $end -gt $start) {
    $jsonText = $jsonText.Substring($start, $end - $start + 1)
    $generated = $jsonText | ConvertFrom-Json
  } else {
    throw "No se pudo parsear JSON generado por Ollama"
  }
}

if (-not $generated.posts) { $generated | Add-Member -MemberType NoteProperty -Name posts -Value @() }
if (-not $generated.news) { $generated | Add-Member -MemberType NoteProperty -Name news -Value @() }

$postMap = @{}
foreach($p in $feed.posts){ if($p.slug){ $postMap[$p.slug] = $true } }
$newsMap = @{}
foreach($n in $feed.news){ if($n.slug){ $newsMap[$n.slug] = $true } }

$addedPosts = 0
foreach($p in @($generated.posts)){
  if(-not $p.slug -or $postMap.ContainsKey([string]$p.slug)){ continue }
  if(-not $p.category){ $p.category = 'Mantenimiento' }
  if(-not $p.date){ $p.date = $today }
  if(-not $p.author){ $p.author = 'Redaccion' }
  if(-not $p.excerpt){
    $base = [string]$p.content
    if($base.Length -gt 180){ $p.excerpt = $base.Substring(0,180) + '...' } else { $p.excerpt = $base }
  }
  $feed.posts += $p
  $postMap[[string]$p.slug] = $true
  $addedPosts++
}

$addedNews = 0
foreach($n in @($generated.news)){
  if(-not $n.slug -or $newsMap.ContainsKey([string]$n.slug)){ continue }
  if(-not $n.tag){ $n.tag = 'Consejos' }
  if(-not $n.date){ $n.date = $today }
  if(-not $n.summary){
    $base = [string]$n.content
    if($base.Length -gt 150){ $n.summary = $base.Substring(0,150) + '...' } else { $n.summary = $base }
  }
  $feed.news += $n
  $newsMap[[string]$n.slug] = $true
  $addedNews++
}

$feed.updatedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
$feed | ConvertTo-Json -Depth 12 | Set-Content -Path $feedPath -Encoding UTF8

"backup=$backupPath"
"addedPosts=$addedPosts"
"addedNews=$addedNews"
"totalPosts=$($feed.posts.Count)"
"totalNews=$($feed.news.Count)"
