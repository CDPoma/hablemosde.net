(function () {
  const menuToggle = document.getElementById("menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");
  const desktopSearch = document.getElementById("desktop-search");
  const mobileSearch = document.getElementById("mobile-search");
  const resultBox = document.getElementById("search-results");
  const latestPosts = document.getElementById("latest-posts");
  const latestNews = document.getElementById("latest-news");
  const feedStatus = document.getElementById("feed-status");
  const currentYear = document.getElementById("current-year");
  const navLinks = Array.from(document.querySelectorAll(".nav-link"));
  const sections = ["inicio", "guias", "publicaciones", "productos", "consejos"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const cookieBanner = document.getElementById("cookie-banner");
  const cookieAccept = document.getElementById("cookie-accept");
  const cookieReject = document.getElementById("cookie-reject");
  const consentKey = "hablemosdejardineria_cookie_consent";

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80);
  }

  function isUsableUrl(url) {
    const value = String(url || "").trim();
    return value !== "" && value !== "#";
  }

  function buildEntryUrl(type, item) {
    if (isUsableUrl(item && item.url)) {
      return item.url;
    }

    const title = item && item.title;
    const slug = item && item.slug ? String(item.slug) : slugify(title);
    if (!slug) {
      return "#publicaciones";
    }

    if (type === 'post') return `./articulos/${slug}.html`;
    return `./entrada.html?type=${encodeURIComponent(type)}&slug=${encodeURIComponent(slug)}`;
  }

  function setCurrentYear() {
    if (currentYear) {
      currentYear.textContent = String(new Date().getFullYear());
    }
  }

  function sanitize(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function searchableCards() {
    return Array.from(document.querySelectorAll("[data-searchable]"));
  }

  function toggleMenu() {
    if (!menuToggle || !mobileMenu) {
      return;
    }

    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
    mobileMenu.hidden = expanded;
  }

  function syncSearchInputs(source, target) {
    if (source && target) {
      target.value = source.value;
    }
  }

  function runSearch(value) {
    if (!resultBox) {
      return;
    }

    const query = String(value || "").trim().toLowerCase();
    let visibleCount = 0;

    searchableCards().forEach((card) => {
      const matches = !query || card.textContent.toLowerCase().includes(query);
      card.hidden = !matches;
      if (matches) {
        visibleCount += 1;
      }
    });

    if (!query) {
      resultBox.hidden = true;
      resultBox.textContent = "";
      return;
    }

    resultBox.hidden = false;
    resultBox.textContent = visibleCount > 0
      ? `Busqueda activa: "${value}". Se muestran ${visibleCount} resultados relacionados.`
      : `No hay resultados para "${value}". Prueba con terminos como cesped, poda, abono, riego o plantas.`;
  }

  function createPostCard(post) {
    const href = buildEntryUrl("post", post);
    return [
      '<article data-searchable class="feed-card">',
      '  <div class="feed-meta">',
      `    <span class="tag">${sanitize(post.category || "Guia")}</span>`,
      `    <small>${sanitize(post.date || "Reciente")}</small>`,
      "  </div>",
      `  <h4>${sanitize(post.title || "Nueva publicacion")}</h4>`,
      `  <p>${sanitize(post.excerpt || "Contenido listo para publicarse.")}</p>`,
      `  <a class="feed-link" href="${sanitize(href)}">Leer mas</a>`,
      "</article>"
    ].join("");
  }

  function createNewsCard(item) {
    const href = buildEntryUrl("news", item);
    return [
      '<article data-searchable class="feed-card">',
      '  <div class="feed-meta">',
      `    <span class="tag">${sanitize(item.tag || "Noticia")}</span>`,
      `    <small>${sanitize(item.date || "Hoy")}</small>`,
      "  </div>",
      `  <h4>${sanitize(item.title || "Actualizacion del sector")}</h4>`,
      `  <p>${sanitize(item.summary || "Resumen pendiente de publicacion.")}</p>`,
      `  <a class="feed-link" href="${sanitize(href)}">Ver noticia</a>`,
      "</article>"
    ].join("");
  }

  async function loadEditorialFeed() {
    if (!latestPosts || !latestNews || !feedStatus) {
      return;
    }

    try {
      const response = await fetch("./content/feed.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Feed no disponible");
      }

      const feed = await response.json();
      const posts = Array.isArray(feed.posts) ? feed.posts : [];
      const news = Array.isArray(feed.news) ? feed.news : [];

      if (posts.length > 0) {
        latestPosts.innerHTML = posts.slice(0, 4).map(createPostCard).join("");
      }

      if (news.length > 0) {
        latestNews.innerHTML = news.slice(0, 4).map(createNewsCard).join("");
      }

      feedStatus.textContent = `Feed sincronizado: ${posts.length} publicaciones y ${news.length} noticias disponibles.`;
    } catch (error) {
      feedStatus.textContent = "Feed no disponible. Se mantiene el contenido base de la portada.";
    }
  }

  function initObserver() {
    if (!("IntersectionObserver" in window) || navLinks.length === 0) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        navLinks.forEach((link) => {
          const active = link.getAttribute("href") === `#${entry.target.id}`;
          link.classList.toggle("is-active", active);
        });
      });
    }, {
      rootMargin: "-35% 0px -45% 0px",
      threshold: 0.1
    });

    sections.forEach((section) => observer.observe(section));
  }

  function setConsent(value) {
    localStorage.setItem(consentKey, value);
    if (cookieBanner) {
      cookieBanner.hidden = true;
    }
  }

  function initCookies() {
    if (!cookieBanner) {
      return;
    }

    const saved = localStorage.getItem(consentKey);
    cookieBanner.hidden = saved === "accepted" || saved === "rejected";

    if (cookieAccept) {
      cookieAccept.addEventListener("click", () => setConsent("accepted"));
    }

    if (cookieReject) {
      cookieReject.addEventListener("click", () => setConsent("rejected"));
    }
  }

  if (menuToggle) {
    menuToggle.addEventListener("click", toggleMenu);
  }

  if (desktopSearch) {
    desktopSearch.addEventListener("input", (event) => {
      syncSearchInputs(desktopSearch, mobileSearch);
      runSearch(event.target.value);
    });
  }

  if (mobileSearch) {
    mobileSearch.addEventListener("input", (event) => {
      syncSearchInputs(mobileSearch, desktopSearch);
      runSearch(event.target.value);
    });
  }

  setCurrentYear();
  initObserver();
  initCookies();
  loadEditorialFeed();
})();
