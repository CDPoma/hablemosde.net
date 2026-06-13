# Tools

## sync-generaitor.ps1

Sincroniza publicaciones desde el modulo GenerAItor (FastAPI) hacia el feed estatico de la web.

Requisitos:
- GenerAItor modulo `generaitor` levantado (backend en http://127.0.0.1:8001)

Ejemplo:

powershell -ExecutionPolicy Bypass -File .\tools\sync-generaitor.ps1 -GeneraitorBaseUrl http://127.0.0.1:8001 -Limit 80 -NicheContains piscina

Notas:
- Por defecto solo importa publicaciones con status=published.
- Usa backup automatico del feed antes de escribir.

## PLANTILLA_GENERAITOR.md

Guia corta para copiar y pegar contenido generado manualmente en `content/feed.json` sin romper el formato.

Incluye:
- Plantilla de objeto `posts`
- Plantilla de objeto `news`
- Reglas de categoria/tag
- Comando rapido de validacion JSON
