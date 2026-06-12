param(
  [string]$GeneraitorBaseUrl = "http://127.0.0.1:8001",
  [int]$Limit = 80,
  [string]$NicheContains = "piscina",
  [switch]$IncludeQueued
)

$ErrorActionPreference = "Stop"

function Get-Slug([string]$Title) {
  if ([string]::IsNullOrWhiteSpace($Title)) {
    return ""
  }

  $t = $Title.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $t.ToCharArray()) {
    $cat = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
    if ($cat -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$sb.Append($ch)
    }
  }

  $clean = $sb.ToString().ToLowerInvariant()
  $clean = [Regex]::Replace($clean, "[^a-z0-9]+", "-")
  $clean = $clean.Trim("-")
  if ($clean.Length -gt 80) {
    $clean = $clean.Substring(0, 80).Trim("-")
  }
  return $clean
}

function Strip-Html([string]$Html) {
  if ([string]::IsNullOrWhiteSpace($Html)) {
    return ""
  }
  $text = [Regex]::Replace($Html, "<script[^>]*>[\s\S]*?</script>", " ", "IgnoreCase")
  $text = [Regex]::Replace($text, "<style[^>]*>[\s\S]*?</style>", " ", "IgnoreCase")
  $text = [Regex]::Replace($text, "<[^>]+>", " ")
  $text = $text -replace "&nbsp;", " "
  $text = $text -replace "&amp;", "&"
  $text = $text -replace "&quot;", '"'
  $text = $text -replace "&#39;", "'"
  $text = $text -replace "&lt;", "<"
  $text = $text -replace "&gt;", ">"
  $text = [Regex]::Replace($text, "\s+", " ").Trim()
  return $text
}

function To-Excerpt([string]$PlainText, [int]$MaxLen = 220) {
  $t = ($PlainText ?? "").Trim()
  if ($t.Length -le $MaxLen) {
    return $t
  }
  $cut = $t.Substring(0, $MaxLen)
  $lastSpace = $cut.LastIndexOf(" ")
  if ($lastSpace -gt 80) {
    $cut = $cut.Substring(0, $lastSpace)
  }
  return ($cut.Trim() + "...")
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$feedPath = Join-Path $repoRoot "content\feed.json"
$backupPath = Join-Path $repoRoot ("content\feed.backup.{0}.json" -f (Get-Date -Format "yyyyMMdd-HHmmss"))

if (!(Test-Path $feedPath)) {
  throw "No existe content/feed.json en: $feedPath"
}

Copy-Item $feedPath $backupPath -Force

$endpoint = "$GeneraitorBaseUrl/api/publications?limit=$Limit"
Write-Host "Leyendo publicaciones desde $endpoint"

$publicationsResponse = Invoke-RestMethod -Uri $endpoint -Method Get -TimeoutSec 30
$publications = @()
if ($publicationsResponse -and $publicationsResponse.publications) {
  $publications = @($publicationsResponse.publications)
}

if ($publications.Count -eq 0) {
  Write-Host "No hay publicaciones en GenerAItor. Nada que sincronizar."
  exit 0
}

$feed = Get-Content $feedPath -Raw | ConvertFrom-Json
if (-not $feed.posts) { $feed | Add-Member -MemberType NoteProperty -Name posts -Value @() }
if (-not $feed.news) { $feed | Add-Member -MemberType NoteProperty -Name news -Value @() }

$existingBySlug = @{}
foreach ($p in @($feed.posts)) {
  if ($p.slug) {
    $existingBySlug[$p.slug] = $true
  }
}

$added = 0
foreach ($pub in $publications) {
  if (-not $IncludeQueued) {
    if ($pub.status -ne "published") {
      continue
    }
  }

  if ($NicheContains -and $pub.niche) {
    if ($pub.niche.ToLowerInvariant().IndexOf($NicheContains.ToLowerInvariant()) -lt 0) {
      continue
    }
  }

  $title = [string]$pub.title
  if ([string]::IsNullOrWhiteSpace($title)) {
    continue
  }

  $slug = Get-Slug $title
  if ([string]::IsNullOrWhiteSpace($slug)) {
    continue
  }

  if ($existingBySlug.ContainsKey($slug)) {
    continue
  }

  $contentHtml = [string]$pub.content
  $plain = Strip-Html $contentHtml
  $excerpt = To-Excerpt $plain

  $date = ""
  if ($pub.published_at) {
    try {
      $dt = [DateTimeOffset]::Parse([string]$pub.published_at)
      $date = $dt.ToString("d MMMM yyyy", [Globalization.CultureInfo]::GetCultureInfo("es-ES"))
    } catch {
      $date = ""
    }
  }
  if ([string]::IsNullOrWhiteSpace($date)) {
    $date = (Get-Date).ToString("d MMMM yyyy", [Globalization.CultureInfo]::GetCultureInfo("es-ES"))
  }

  $category = ""
  if ($pub.category) { $category = [string]$pub.category }
  if ([string]::IsNullOrWhiteSpace($category)) { $category = "Publicacion" }

  $author = "Redaccion"
  if ($pub.source) { $author = "Redaccion" }

  $post = [ordered]@{
    slug = $slug
    title = $title
    excerpt = $excerpt
    category = $category
    date = $date
    author = $author
    contentHtml = $contentHtml
  }

  $feed.posts += (New-Object PSObject -Property $post)
  $existingBySlug[$slug] = $true
  $added += 1
}

$feed.updatedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")

# Ordenar posts por fecha de creacion en GenerAItor (si existe), si no, mantener
$feed.posts = @($feed.posts) | Select-Object -First 200

$feed | ConvertTo-Json -Depth 12 | Set-Content -Path $feedPath -Encoding UTF8

Write-Host "Sincronizacion completada. Aniadidas: $added entradas. Backup: $backupPath"
