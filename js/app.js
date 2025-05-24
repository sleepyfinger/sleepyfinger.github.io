document.addEventListener("DOMContentLoaded", () => {
  const appRoot = document.getElementById("app-root");
  const teamSiteTitleBase = "SleepyFinger - 인디 게임 개발팀";

  const ROUTES = {
    HOME: "/",
    BLOG: "/blog",
    GAMES: "/games",
    POST_PREFIX: "/post/",
  };

  const CONTENT_PATH_PREFIX = {
    PAGES: "pages/",
    POSTS: "posts/",
  };
  const MARKDOWN_EXTENSION = ".md";

  function parseMarkdown(rawContent) {
    const lines = rawContent.split("\n");
    const metadata = {};
    let contentStartIndex = 0;

    if (lines.length > 0 && lines[0].trim() === "---") {
      contentStartIndex = 1;
      let frontmatterEndIndex = -1;

      for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        frontmatterEndIndex = i;
        break;
      }
        const separatorIndex = lines[i].indexOf(":");
        if (separatorIndex > 0) {
          const key = lines[i].substring(0, separatorIndex).trim();
          let value = lines[i].substring(separatorIndex + 1).trim();
          if (
            (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) ||
            (value.length >= 2 && value.startsWith('"') && value.endsWith('"'))
          ) {
            value = value.substring(1, value.length - 1);
          }
          metadata[key] = value;
        }
    }

      if (frontmatterEndIndex !== -1) {
        contentStartIndex = frontmatterEndIndex + 1;
      } else {
        console.warn(
          "Markdown frontmatter started with '---' but was not properly closed. Treating entire input as content."
        );
        contentStartIndex = 0;
        for (const key in metadata) delete metadata[key];
      }
    }
    const content = lines.slice(contentStartIndex).join("\n").trim();
    return { metadata, content };
  }

  async function loadAndRenderHTML({
    filePath,
    targetElement,
    successCallback,
    errorTitle = "페이지 로딩 오류",
    fallbackHTMLOnError,
  }) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(
          `Failed to load ${filePath}: ${response.status} ${response.statusText}`
        );
      }
      const htmlContent = await response.text();
      targetElement.innerHTML = htmlContent;
      if (successCallback) {
        successCallback();
      }
    } catch (error) {
      console.error(`Error rendering ${filePath}:`, error);
      if (fallbackHTMLOnError) {
        targetElement.innerHTML = fallbackHTMLOnError;
      } else {
        targetElement.innerHTML = `<p>${errorTitle}: 요청하신 내용을 불러오는 중 문제가 발생했습니다. (${error.message})</p>`;
      }
    }
  }

  async function router() {
    const path = window.location.hash.slice(1).toLowerCase() || "/";
    appRoot.innerHTML = "";

    if (path === ROUTES.HOME) {
      await renderTeamHomePage();
      document.title = teamSiteTitleBase;
    } else if (path === ROUTES.BLOG) {
      await renderBlogListPage();
      document.title = `블로그 | ${teamSiteTitleBase}`;
    } else if (path === ROUTES.GAMES) {
      await renderGamesPage();
      document.title = `게임 | ${teamSiteTitleBase}`;
    } else if (path.startsWith(ROUTES.POST_PREFIX)) {
      const slug = path.substring(ROUTES.POST_PREFIX.length);
      await renderPostPage(slug);
    } else {
      await renderNotFound();
    }
    window.scrollTo(0, 0);
  }

  async function renderTeamHomePage() {
    await loadAndRenderHTML({
      filePath: `${CONTENT_PATH_PREFIX.PAGES}home.html`,
      targetElement: appRoot,
      successCallback: () => updateActiveNav(ROUTES.HOME),
      errorTitle: "팀 소개 페이지 로딩 오류",
      fallbackHTMLOnError:
        "<p>페이지를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.</p>",
    });
  }

  async function renderBlogListPage() {
    const postListContainer = document.createElement("div");
    postListContainer.className = "post-list";
    appRoot.appendChild(postListContainer);

    if (
      typeof postManifest === "undefined" ||
      !Array.isArray(postManifest) ||
      postManifest.length === 0
    ) {
      await loadAndRenderHTML({
        filePath: `${CONTENT_PATH_PREFIX.PAGES}blog-empty.html`,
        targetElement: postListContainer,
        errorTitle: "블로그 목록 로딩 오류",
        fallbackHTMLOnError:
          "<p>게시물 정보를 불러오는 중 오류가 발생했습니다.</p>",
      });
    } else {
      const sortedPosts = [...postManifest].sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateB - dateA;
      });

      sortedPosts.forEach((post) => {
        const postItem = document.createElement("article");
        postItem.className = "post-item";
        postItem.innerHTML = `
                    <h2><a href="#${ROUTES.POST_PREFIX}${post.slug}">${post.title}</a></h2>
                    <p class="post-meta">작성자: ${post.author} | 날짜: ${post.date}</p>
                    <p class="post-excerpt">${post.excerpt}</p>
                    <a href="#${ROUTES.POST_PREFIX}${post.slug}" class="read-more">더 읽기 &rarr;</a>
                `;
        postListContainer.appendChild(postItem);
      });
    }
    updateActiveNav(ROUTES.BLOG);
  }

  async function renderGamesPage() {
    await loadAndRenderHTML({
      filePath: `${CONTENT_PATH_PREFIX.PAGES}games.html`,
      targetElement: appRoot,
      successCallback: () => updateActiveNav(ROUTES.GAMES),
      errorTitle: "게임 정보 로딩 오류",
      fallbackHTMLOnError:
        "<p>게임 정보를 불러오는 중 오류가 발생했습니다.</p>",
    });
  }

  async function renderPostPage(slug) {
    try {
      const response = await fetch(`${CONTENT_PATH_PREFIX.POSTS}${slug.toLowerCase()}${MARKDOWN_EXTENSION}`);
      if (!response.ok) {
        throw new Error(`Post '${slug}.md' not found (${response.status})`);
      }
      const rawContent = await response.text();
      const { metadata, content: rawMarkdownContent } =
        parseMarkdown(rawContent);

      const htmlContent =
        typeof marked !== "undefined"
          ? marked.parse(rawMarkdownContent)
          : rawMarkdownContent;

      const displayTitle =
        metadata.title ||
        slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
      const displayAuthor = metadata.author || "Unknown Author";
      const displayDate = metadata.date || "Unknown Date";

      document.title = `${displayTitle} | ${teamSiteTitleBase}`;
      const postContainer = document.createElement("article");
      postContainer.className = "post-full";
      postContainer.innerHTML = `
                <h1 class="post-title">${displayTitle}</h1>
                <p class="post-meta">작성자: ${displayAuthor} | 날짜: ${displayDate}</p>
                <div class="post-content">
                    ${htmlContent}
                </div>
                <a href="#${ROUTES.BLOG}" class="back-to-list" style="display:inline-block; margin-top:30px; color: #3498db; text-decoration:none;">&larr; 블로그 목록으로 돌아가기</a>
            `;
      appRoot.appendChild(postContainer);
      updateActiveNav(ROUTES.BLOG);
    } catch (error) {
      console.error("Error fetching or parsing post:", error);
      await renderNotFound();
    }
  }

  async function renderNotFound() {
    document.title = `페이지를 찾을 수 없음 | ${teamSiteTitleBase}`;
    updateActiveNav("");
    try {
      const response = await fetch(`${CONTENT_PATH_PREFIX.PAGES}not-found.html`);
      if (!response.ok) {
        console.warn(
          `${CONTENT_PATH_PREFIX.PAGES}not-found.html not found (${response.status}), using fallback HTML.`
        );
        appRoot.innerHTML = `
            <h2>404 - 페이지를 찾을 수 없습니다.</h2>
            <p>요청하신 페이지가 존재하지 않거나, 주소가 변경되었을 수 있습니다.</p>
            <p><a href="#${ROUTES.HOME}">팀 소개 페이지로 돌아가기</a></p>
        `;
      } else {
        const rawContent = await response.text();
        appRoot.innerHTML = rawContent;
      }
    } catch (error) {
      console.error("Error rendering not found page:", error);
      appRoot.innerHTML = `
            <h2>오류 발생</h2>
            <p>페이지를 표시하는 중 문제가 발생했습니다. <a href="#${ROUTES.HOME}">홈으로 돌아가기</a></p>
        `;
    }
  }

  function updateActiveNav(activeRoute) {
    document.querySelectorAll("header nav a").forEach((link) => {
      const linkHref = link.getAttribute("href");

      if (!linkHref || !linkHref.startsWith("#")) {
        link.classList.remove("active");
        return;
      }

      const linkPath = linkHref.slice(1);
      if (activeRoute === "") {
        link.classList.remove("active");
      } else if (linkPath === activeRoute) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }
  window.addEventListener("hashchange", router);
  router();
});
