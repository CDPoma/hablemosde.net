(function () {
  const typeEl = document.getElementById("entry-type");
  const titleEl = document.getElementById("entry-title");
  const metaEl = document.getElementById("entry-meta");
  const bodyEl = document.getElementById("entry-body");

  function sanitize(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80);
  }

  function getParams() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type") || "post";
    const slug = params.get("slug") || "";
    return { type, slug };
  }

  function renderNotFound() {
    if (titleEl) titleEl.textContent = "Entrada no encontrada";
    if (metaEl) metaEl.textContent = "";
    if (bodyEl) {
      bodyEl.innerHTML = [
        '<p class="entry-lead">No encontramos la entrada solicitada. Puede que el feed se haya actualizado o el enlace sea antiguo.</p>',
        '<p>Vuelve a la portada para ver las últimas publicaciones y guías de jardinería.</p>'
      ].join("");
    }
  }

  function renderEntry(kind, entry) {
    const title = entry && entry.title ? String(entry.title) : "Entrada";
    const date = entry && entry.date ? String(entry.date) : "";
    const label = kind === "news" ? (entry.tag || "Noticia") : (entry.category || "Guia");
    const author = entry && entry.author ? String(entry.author) : "";

    if (typeEl) typeEl.textContent = kind === "news" ? "Noticia" : "Publicacion";
    if (titleEl) titleEl.textContent = title;

    const metaParts = [label, date, author].filter(Boolean);
    if (metaEl) metaEl.textContent = metaParts.join(" · ");

    const summary = kind === "news" ? entry.summary : entry.excerpt;
    const content = entry && entry.content ? entry.content : "";
    const contentHtml = entry && entry.contentHtml ? entry.contentHtml : "";

    if (bodyEl) {
      const blocks = [];
      if (summary) {
        blocks.push(`<p class="entry-lead">${sanitize(summary)}</p>`);
      }

      if (contentHtml) {
        // contentHtml viene del feed; solo debe usarse si lo controlas.
        blocks.push(String(contentHtml));
      } else if (content) {
        blocks.push(`<p>${sanitize(content)}</p>`);
      } else {
        blocks.push('<p>Si quieres mostrar el texto completo aquí, añade <strong>content</strong> o <strong>contentHtml</strong> en el feed JSON.</p>');
      }

      bodyEl.innerHTML = blocks.join("");
    }
  }

  async function main() {
    const { type, slug } = getParams();
    const normalizedType = type === "news" ? "news" : "post";

    try {
      const response = await fetch("./content/feed.json", { cache: "no-store" });
      if (!response.ok) {
        renderNotFound();
        return;
      }

      const feed = await response.json();
      const list = normalizedType === "news"
        ? (Array.isArray(feed.news) ? feed.news : [])
        : (Array.isArray(feed.posts) ? feed.posts : []);

      const match = list.find((item) => {
        const itemSlug = item && item.slug ? String(item.slug) : slugify(item && item.title);
        return itemSlug === slug;
      });

      if (!match) {
        renderNotFound();
        return;
      }

      renderEntry(normalizedType, match);
    } catch (error) {
      renderNotFound();
    }
  }

  main();
})();
