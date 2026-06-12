$ErrorActionPreference = 'Stop'
Set-Location "$PSScriptRoot\.."

$feedPath = ".\content\feed.json"
$backupPath = ".\content\feed.backup.ollama.$((Get-Date).ToString('yyyyMMdd-HHmmss')).json"
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

function New-Excerpt([string]$content, [int]$max=190){
  $txt = [Regex]::Replace(($content -replace "`r|`n",' '), '\s+', ' ').Trim()
  if($txt.Length -le $max){ return $txt }
  $cut = $txt.Substring(0,$max)
  $i = $cut.LastIndexOf(' ')
  if($i -gt 80){ $cut = $cut.Substring(0,$i) }
  return ($cut.Trim() + '...')
}

function Invoke-Transform([string]$topic,[string]$title,[string]$mode,[string]$tone,[string]$sourceText){
  $seed = $sourceText
  if (($seed | Out-String).Trim().Length -lt 320) {
    $seed = "$sourceText " +
      "Contexto editorial: articulo para nicho de piscinas en Espana, orientado a usuario domestico. " +
      "Debe incluir pasos accionables, errores frecuentes, criterios de decision y cierre con checklist. " +
      "Evitar afirmaciones tecnicas no verificables y promesas absolutas. " +
      "Mantener tono claro, util y practico. Incluir recomendaciones de mantenimiento preventivo, " +
      "seguridad basica y eficiencia de filtracion cuando aplique."
  }

  $body = @{
    topic = $topic
    title = $title
    source_text = $seed
    mode = $mode
    tone = $tone
    language = 'es'
    niche_name = 'HablemosdePiscinas'
    primary_keywords = @('piscina','mantenimiento','agua','filtracion')
  } | ConvertTo-Json -Depth 5

  Invoke-RestMethod -Uri 'http://127.0.0.1:8001/api/transform' -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 180
}

$today = (Get-Date).ToString('d MMMM yyyy', [Globalization.CultureInfo]::GetCultureInfo('es-ES'))

$postsPlan = @(
  @{cat='Mantenimiento'; topic='Mantenimiento'; title='Guia avanzada para estabilizar pH y cloro en verano'; src='Articulo practico con rutina semanal, medicion, errores frecuentes y checklist final.'},
  @{cat='Mantenimiento'; topic='Mantenimiento'; title='Como mantener agua cristalina con niños y uso intenso'; src='Ajustes de filtracion, limpieza y desinfeccion cuando hay mucho uso familiar.'},
  @{cat='Problemas'; topic='Problemas'; title='Piscina con olor fuerte a cloro: que significa realmente'; src='Explicar cloraminas, causas y correccion paso a paso sin mitos.'},
  @{cat='Problemas'; topic='Problemas'; title='Espuma en la piscina: causas y solucion sin vaciar'; src='Causas habituales, diagnostico rapido y solucion por fases.'},
  @{cat='Filtracion'; topic='Filtracion'; title='Como ajustar la depuradora para ahorrar luz sin perder calidad de agua'; src='Estrategia por tramos horarios segun calor y carga de uso.'},
  @{cat='Filtracion'; topic='Filtracion'; title='Arena del filtro: cuando cambiarla y señales de desgaste'; src='Vida util, sintomas de desgaste y mantenimiento preventivo.'},
  @{cat='Seguridad'; topic='Seguridad'; title='Checklist de seguridad antes de abrir la piscina cada dia'; src='Checklist diario para familias, barreras y supervision.'},
  @{cat='Temporada'; topic='Temporada'; title='Que revisar despues de una semana fuera de casa'; src='Guia de retorno: niveles, filtracion, limpieza y seguridad.'}
)

$newsPlan = @(
  @{tag='Temporada'; topic='Actualidad'; title='Sube la demanda de mantenimiento preventivo en piscinas domesticas'; src='Pieza breve tipo actualidad editorial.'},
  @{tag='Filtracion'; topic='Actualidad'; title='Mas consultas sobre consumo electrico en depuracion durante olas de calor'; src='Noticia breve sobre eficiencia y buenas practicas.'}
)

$existing = @{}
foreach($p in $feed.posts){ if($p.slug){ $existing[$p.slug] = $true } }
$existingNews = @{}
foreach($n in $feed.news){ if($n.slug){ $existingNews[$n.slug] = $true } }

$addedPosts = 0
$addedNews = 0

foreach($p in $postsPlan){
  try{
    $resp = Invoke-Transform -topic $p.topic -title $p.title -mode 'expand' -tone 'informativo-practico' -sourceText $p.src
    $title = if($resp.title){ [string]$resp.title } else { [string]$p.title }
    $content = if($resp.content){ [string]$resp.content } else { [string]$p.src }
    $slug = New-Slug $title
    if(!$slug -or $existing.ContainsKey($slug)){ continue }
    $obj = [ordered]@{
      slug = $slug
      title = $title
      excerpt = (New-Excerpt $content)
      category = $p.cat
      date = $today
      author = 'Redaccion'
      content = $content
    }
    $feed.posts += (New-Object psobject -Property $obj)
    $existing[$slug] = $true
    $addedPosts++
  } catch {
    Write-Host "WARN post: $($p.title)"
  }
}

foreach($n in $newsPlan){
  try{
    $resp = Invoke-Transform -topic $n.topic -title $n.title -mode 'summary' -tone 'periodistico-breve' -sourceText $n.src
    $title = if($resp.title){ [string]$resp.title } else { [string]$n.title }
    $content = if($resp.content){ [string]$resp.content } else { [string]$n.src }
    $slug = New-Slug $title
    if(!$slug -or $existingNews.ContainsKey($slug)){ continue }
    $obj = [ordered]@{
      slug = $slug
      title = $title
      summary = (New-Excerpt $content 165)
      tag = $n.tag
      date = $today
      content = $content
    }
    $feed.news += (New-Object psobject -Property $obj)
    $existingNews[$slug] = $true
    $addedNews++
  } catch {
    Write-Host "WARN news: $($n.title)"
  }
}

$feed.updatedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
$feed | ConvertTo-Json -Depth 12 | Set-Content -Path $feedPath -Encoding UTF8

"backup=$backupPath"
"addedPosts=$addedPosts"
"addedNews=$addedNews"
"totalPosts=$($feed.posts.Count)"
"totalNews=$($feed.news.Count)"
