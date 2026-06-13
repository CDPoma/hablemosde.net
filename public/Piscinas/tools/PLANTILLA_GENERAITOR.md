# Plantilla rapida (30 segundos)

Objetivo: pegar contenido de GenerAItor en `content/feed.json` sin romper formato.

## 1) Para una publicacion

Copia este bloque y pegalo al final del array `posts`:

```json
{
  "slug": "titulo-en-minusculas-con-guiones",
  "title": "Titulo del articulo",
  "excerpt": "Resumen corto de 1-2 frases para la tarjeta.",
  "category": "Mantenimiento",
  "date": "2 junio 2026",
  "author": "Redaccion",
  "content": "Texto completo del articulo."
}
```

## 2) Para una noticia/actualidad

Copia este bloque y pegalo al final del array `news`:

```json
{
  "slug": "titular-breve-con-guiones",
  "title": "Titular de actualidad",
  "summary": "Resumen breve de noticia o tendencia.",
  "tag": "Mantenimiento",
  "date": "2 junio 2026",
  "content": "Desarrollo breve de la pieza de actualidad."
}
```

## 3) Reglas para no fallar

- `slug` unico y en minusculas con guiones.
- No dejes coma al final del ultimo objeto del array.
- Usa solo categorias de este proyecto:
  - `Mantenimiento`
  - `Problemas`
  - `Filtracion`
  - `Seguridad`
  - `Temporada`
- En noticias, usa `tag` corto (por ejemplo `Mantenimiento`, `Ahorro`, `Productos`).

## 4) Minicheck rapido

Si quieres validar en PowerShell:

```powershell
Get-Content .\content\feed.json -Raw | ConvertFrom-Json | Out-Null
```

Si no da error, el JSON es valido.
