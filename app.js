// Forsaken Realm — skeleton frontend
// No build step, no framework. Everything here is same-origin fetches
// against static JSON files sitting in this same repo.
//
// IMPORTANT (read this before treating this as done):
// This login is UX, not security. Every file it checks against is public
// and fetchable by anyone regardless of whether they "log in." See the
// hardcoded users.json for the real explanation. Do not add anything to
// this repo that actually needs to stay secret.

const SESSION_KEY = "fr_session";

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.hidden = true;

  const users = await fetch("data/users.json").then((r) => r.json());
  const hash = await sha256Hex(password);
  const match = users.find(
    (u) => u.username === username && u.passwordHash === hash
  );

  if (!match) {
    errorEl.textContent = "Wrong username or password.";
    errorEl.hidden = false;
    return;
  }

  setSession({
    username: match.username,
    role: match.role,
    assignedCampaigns: match.assignedCampaigns || null,
  });
  showApp();
}

function handleLogout() {
  clearSession();
  document.getElementById("login-view").hidden = false;
  document.getElementById("app-view").hidden = true;
  document.getElementById("who").hidden = true;
  document.getElementById("login-form").reset();
}

async function showApp() {
  const session = getSession();
  if (!session) return;

  document.getElementById("login-view").hidden = true;
  document.getElementById("app-view").hidden = false;
  document.getElementById("who").hidden = false;
  document.getElementById("who-name").textContent =
    `${session.username} (${session.role})`;

  const manifest = await fetch("data/manifest.json").then((r) => r.json());
  const visibleCampaigns =
    session.role === "admin"
      ? manifest.campaigns
      : manifest.campaigns.filter((slug) =>
          (session.assignedCampaigns || []).includes(slug)
        );

  const nav = document.getElementById("campaign-nav");
  nav.innerHTML = "";
  visibleCampaigns.forEach((slug, i) => {
    const btn = document.createElement("button");
    btn.textContent = slug;
    btn.setAttribute("aria-current", i === 0 ? "true" : "false");
    btn.addEventListener("click", () => {
      [...nav.children].forEach((c) =>
        c.setAttribute("aria-current", c === btn ? "true" : "false")
      );
      loadCampaign(slug);
    });
    nav.appendChild(btn);
  });

  if (visibleCampaigns.length) {
    loadCampaign(visibleCampaigns[0]);
  } else {
    document.getElementById("campaign-content").textContent =
      "No campaigns assigned to this account yet.";
  }
}

async function loadCampaign(slug) {
  const base = `data/campaigns/${slug}/`;
  const [meta, partyLog, characters] = await Promise.all([
    fetch(base + "meta.json").then((r) => r.json()),
    fetch(base + "party-log.json").then((r) => r.json()),
    fetch(base + "characters.json").then((r) => r.json()),
  ]);

  const content = document.getElementById("campaign-content");
  content.innerHTML = "";

  const heading = document.createElement("h2");
  heading.textContent = meta.name;
  content.appendChild(heading);

  const logHeading = document.createElement("h3");
  logHeading.textContent = "Party log";
  content.appendChild(logHeading);
  partyLog.entries.forEach((entry) => {
    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `<h3>${entry.title}</h3><p>${entry.summary}</p>`;
    content.appendChild(div);
  });

  const charHeading = document.createElement("h3");
  charHeading.textContent = "Characters";
  content.appendChild(charHeading);

  const session = getSession();
  const visibleCharacters =
    session.role === "admin"
      ? characters.characters
      : characters.characters.filter((c) => c.player === session.username);

  visibleCharacters.forEach((c) => {
    const div = document.createElement("div");
    div.className = "character";

    const classesText = (c.classes || [])
      .map((cl) =>
        cl.subclass
          ? `${cl.name} (${cl.subclass}) ${cl.level}`
          : `${cl.name} ${cl.level}`
      )
      .join(", ");

    const metaLine = [c.race, c.background, classesText]
      .filter(Boolean)
      .join(" · ");

    const featuresHtml = (c.features || [])
      .map(
        (f) =>
          `<li><strong>${f.name}</strong>${f.description ? `: ${f.description}` : ""}</li>`
      )
      .join("");

    div.innerHTML = `
      <h3>${c.name}</h3>
      ${metaLine ? `<p class="char-meta">${metaLine}</p>` : ""}
      <p class="char-stats">HP ${c.hp.value}/${c.hp.max} &middot; AC ${c.ac}</p>
      <p>${c.bio}</p>
      ${featuresHtml ? `<details><summary>Features</summary><ul>${featuresHtml}</ul></details>` : ""}
    `;
    content.appendChild(div);
  });
}

document.getElementById("login-form").addEventListener("submit", handleLogin);
document.getElementById("logout-btn").addEventListener("click", handleLogout);

// Resume an existing session on load, if there is one.
if (getSession()) {
  showApp();
}
