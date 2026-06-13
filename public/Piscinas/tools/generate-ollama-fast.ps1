param(
  [string]$Model = "hermes3:latest",
  [int]$PostsToGenerate = 6,
  [int]$NewsToGenerate = 2
)

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\.."

$feedPath = ".\content\feed.json"
$backupPath = ".\content\feed.backup.ollama-fast.$((Get-Date).ToString('yyyyMMdd-HHmmss')).json"
Copy-Item $feedPath $backupPath -Force
$feed = Get-Content $feedPath -Raw | ConvertFrom-Json

function New-Slug([string]$text) {
  $s = $text.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach($c in $s.ToCharArray()){
    if([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark){ [void]$sb.Append($c) }
  }
  $out = $sb.ToString().ToLowerInvariant()
  $out = [Regex]::Replace($out, '[^a-z0-9]+', '-')
  $out = $out.Trim('-')
  if($out.Length -gt 90){ $out = $out.Substring(0,90).Trim('-') }
  return $out
}

function New-Excerpt([string]$content, [int]$max = 175){
  $txt = [Regex]::Replace(($content -replace "`r|`n",' '), '\s+', ' ').Trim()
  if($txt.Length -le $max){ return $txt }
  $cut = $txt.Substring(0,$max)
  $i = $cut.LastIndexOf(' ')
  if($i -gt 80){ $cut = $cut.Substring(0,$i) }
  return ($cut.Trim() + '...')
}

function Parse-JsonObject([string]$raw){
  $raw = $raw.Trim()
  try { return ($raw | ConvertFrom-Json) } catch {}
  $start = $raw.IndexOf('{')
  $end = $raw.LastIndexOf('}')
  if($start -ge 0 -and $end -gt $start){
    $json = $raw.Substring($start, $end - $start + 1)
    return ($json | ConvertFrom-Json)
  }
  throw "No se pudo parsear JSON del modelo"
}

$today = (Get-Date).ToString('d MMMM yyyy', [Globalization.CultureInfo]::GetCultureInfo('es-ES'))

$postIdeas = @(
  @{ category='Mantenimiento'; relation='mismo nicho'; title='Como ajustar cloro libre sin irritar ojos en piscina familiar' },
  @{ category='Mantenimiento'; relation='mismo nicho'; title='Checklist semanal para piscina pequena con poco tiempo' },
  @{ category='Problemas'; relation='tema cercano'; title='Agua blanquecina en piscina: diagnostico rapido y solucion' },
  @{ category='Problemas'; relation='tema cercano'; title='Por que aparece alga en esquinas aunque el agua parece limpia' },
  @{ category='Filtracion'; relation='satelite semantico'; title='Como repartir las horas de depuradora durante el dia' },
  @{ category='Filtracion'; relation='satelite semantico'; title='Senales de que el prefiltro de la bomba necesita atencion' },
  @{ category='Seguridad'; relation='mismo nicho'; title='Normas cortas de seguridad para visitas en piscina privada' },
  @{ category='Seguridad'; relation='tema cercano'; title='Como organizar zona de piscina para evitar resbalones' },
  @{ category='Temporada'; relation='satelite semantico'; title='Puesta a punto rapida tras lluvias de verano' },
  @{ category='Temporada'; relation='satelite semantico'; title='Que revisar antes del primer bano del fin de semana' }
)

$newsIdeas = @(
  @{ tag='Mantenimiento'; relation='mismo nicho'; title='Sube el interes por rutinas de control de agua en hogares' },
  @{ tag='Filtracion'; relation='tema cercano'; title='Aumentan consultas sobre ahorro electrico en depuracion' },
  @{ tag='Seguridad'; relation='tema cercano'; title='Mas familias priorizan barreras fisicas en piscinas privadas' },
  @{ tag='Temporada'; relation='satelite semantico'; title='El calor adelanta la temporada de mantenimiento en junio' },
  @{ tag='Problemas'; relation='satelite semantico'; title='Crecen incidencias de turbidez tras uso intensivo de fin de semana' }
)

$postSlugMap = @{}
foreach($p in @($feed.posts)){ if($p.slug){ $postSlugMap[[string]$p.slug] = $true } }
$newsSlugMap = @{}
foreach($n in @($feed.news)){ if($n.slug){ $newsSlugMap[[string]$n.slug] = $true } }

$addedPosts = 0
foreach($idea in $postIdeas){
  if($addedPosts -ge $PostsToGenerate){ break }

  $prompt = @"
Devuelve SOLO un objeto JSON valido, sin markdown.
Estructura exacta:
{
  "title": "...",
  "content": "..."
}

Escribe un articulo en espanol para web de piscinas.
Tema: $($idea.title)
Categoria: $($idea.category)
Relacion semantica: $($idea.relation)
Requisitos:
- 280 a 420 palabras.
- Estilo practico y claro.
- Consejos accionables para piscina domestica.
- Sin enlaces y sin mencionar afiliacion.
- ASCII only (sin caracteres raros).
"@

  try {
    $body = @{
      model = $Model
      prompt = $prompt
      stream = $false
      options = @{ num_predict = 700; temperature = 0.7 }
    } | ConvertTo-Json -Depth 3
    $resp = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 90
    $raw = $resp.response
    $obj = Parse-JsonObject $raw
    $title = [string]$obj.title
    $content = [string]$obj.content
    if([string]::IsNullOrWhiteSpace($title) -or [string]::IsNullOrWhiteSpace($content)){ continue }

    $slug = New-Slug $title
    if([string]::IsNullOrWhiteSpace($slug) -or $postSlugMap.ContainsKey($slug)){ continue }

    $post = [ordered]@{
      slug = $slug
      title = $title
      excerpt = (New-Excerpt $content)
      category = $idea.category
      date = $today
      author = 'Redaccion'
      content = $content
    }

    $feed.posts += (New-Object psobject -Property $post)
    $postSlugMap[$slug] = $true
    $addedPosts++
  } catch {
    Write-Host "WARN post: $($idea.title)"
  }
}

$addedNews = 0
foreach($idea in $newsIdeas){
  if($addedNews -ge $NewsToGenerate){ break }

  $prompt = @"
Devuelve SOLO un objeto JSON valido, sin markdown.
Estructura exacta:
{
  "title": "...",
  "content": "..."
}

Escribe una pieza corta de actualidad para web de piscinas.
Tema: $($idea.title)
Relacion semantica: $($idea.relation)
Requisitos:
- 120 a 220 palabras.
- Tono informativo y directo.
- Sin enlaces y sin afiliacion.
- ASCII only.
"@

  try {
    $body = @{
      model = $Model
      prompt = $prompt
      stream = $false
      options = @{ num_predict = 350; temperature = 0.7 }
    } | ConvertTo-Json -Depth 3
    $resp = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 60
    $raw = $resp.response
    $obj = Parse-JsonObject $raw
    $title = [string]$obj.title
    $content = [string]$obj.content
    if([string]::IsNullOrWhiteSpace($title) -or [string]::IsNullOrWhiteSpace($content)){ continue }

    $slug = New-Slug $title
    if([string]::IsNullOrWhiteSpace($slug) -or $newsSlugMap.ContainsKey($slug)){ continue }

    $news = [ordered]@{
      slug = $slug
      title = $title
      summary = (New-Excerpt $content 150)
      tag = $idea.tag
      date = $today
      content = $content
    }

    $feed.news += (New-Object psobject -Property $news)
    $newsSlugMap[$slug] = $true
    $addedNews++
  } catch {
    Write-Host "WARN news: $($idea.title)"
  }
}

$feed.updatedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
$feed | ConvertTo-Json -Depth 12 | Set-Content -Path $feedPath -Encoding UTF8

"backup=$backupPath"
"addedPosts=$addedPosts"
"addedNews=$addedNews"
"totalPosts=$($feed.posts.Count)"
"totalNews=$($feed.news.Count)"
