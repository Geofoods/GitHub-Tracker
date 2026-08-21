require("dotenv").config();

const { App } = require("@slack/bolt");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

app.command("/github-tracker-ping", async ({ command, ack, respond }) => {
  const start = Date.now();
  await ack();
  const latency = Date.now() - start;
  await respond({ text: `Pong!\nLatency: ${latency}ms` });
});

app.command("/github-user", async ({ command, ack, respond }) => {
  await ack();
  const username = command.text.trim();
  if (!username) {
    return respond({ text: "Please provide a GitHub username. Example: /github-user torvalds" });
  }

  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`);
    if (res.status === 404) {
      return respond({ text: `GitHub user "${username}" not found.` });
    }
    if (!res.ok) {
      return respond({ text: `GitHub API error: ${res.status}` });
    }

    const data = await res.json();
    const stats = [
      `*Username:* ${data.login}`,
      `*Name:* ${data.name || "N/A"}`,
      `*Bio:* ${data.bio || "N/A"}`,
      `*Location:* ${data.location || "N/A"}`,
      `*Public Repos:* ${data.public_repos}`,
      `*Public Gists:* ${data.public_gists}`,
      `*Followers:* ${data.followers}`,
      `*Following:* ${data.following}`,
      `*Account Created:* ${data.created_at ? data.created_at.slice(0, 10) : "N/A"}`,
      `*Profile:* ${data.html_url}`
    ].join("\n");

    await respond({ text: stats });
  } catch (err) {
    await respond({ text: `Error fetching GitHub user: ${err.message}` });
  }
});

app.command("/github-repo", async ({ command, ack, respond }) => {
  await ack();
  const repo = command.text.trim();
  if (!repo) {
    return respond({ text: "Please provide a repository. Example: /github-repo torvalds/linux" });
  }
  if (!repo.includes("/")) {
    return respond({ text: 'Invalid repository format. Use "owner/repo". Example: /github-repo torvalds/linux' });
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`);
    if (res.status === 404) {
      return respond({ text: `Repository "${repo}" not found.` });
    }
    if (!res.ok) {
      return respond({ text: `GitHub API error: ${res.status}` });
    }

    const data = await res.json();
    const info = [
      `*Repository:* ${data.full_name}`,
      `*Description:* ${data.description || "N/A"}`,
      `*Language:* ${data.language || "N/A"}`,
      `*Stars:* ${data.stargazers_count}`,
      `*Forks:* ${data.forks_count}`,
      `*Open Issues:* ${data.open_issues_count}`,
      `*License:* ${data.license ? data.license.name : "N/A"}`,
      `*Created:* ${data.created_at ? data.created_at.slice(0, 10) : "N/A"}`,
      `*Last Updated:* ${data.updated_at ? data.updated_at.slice(0, 10) : "N/A"}`,
      `*Link:* ${data.html_url}`
    ].join("\n");

    await respond({ text: info });
  } catch (err) {
    await respond({ text: `Error fetching repository: ${err.message}` });
  }
});

app.command("/github-activity", async ({ command, ack, respond }) => {
  await ack();
  const repo = command.text.trim();
  if (!repo) {
    return respond({ text: "Please provide a repository. Example: /github-activity torvalds/linux" });
  }
  if (!repo.includes("/")) {
    return respond({ text: 'Invalid repository format. Use "owner/repo". Example: /github-activity torvalds/linux' });
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/commits?per_page=10`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (res.status === 404) {
      return respond({ text: `Repository "${repo}" not found.` });
    }
    if (!res.ok) {
      return respond({ text: `GitHub API error: ${res.status}` });
    }

    const commits = await res.json();
    if (commits.length === 0) {
      return respond({ text: `No commits found for "${repo}".` });
    }

    const lines = commits.map((c, i) => {
      const message = (c.commit.message || "").split("\n")[0];
      const author = c.commit.author?.name || "unknown";
      const date = c.commit.author?.date ? c.commit.author.date.slice(0, 10) : "";
      return `*${i + 1}.* \`${c.sha.slice(0, 7)}\` ${message}\n      ${author} · ${date}`;
    });

    await respond({ text: `*Recent Activity: ${repo}*\n${lines.join("\n")}` });
  } catch (err) {
    await respond({ text: `Error fetching activity: ${err.message}` });
  }
});

app.command("/github-contributors", async ({ command, ack, respond }) => {
  await ack();
  const repo = command.text.trim();
  if (!repo) {
    return respond({ text: "Please provide a repository. Example: /github-contributors torvalds/linux" });
  }
  if (!repo.includes("/")) {
    return respond({ text: 'Invalid repository format. Use "owner/repo". Example: /github-contributors torvalds/linux' });
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/contributors?per_page=10`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (res.status === 404) {
      return respond({ text: `Repository "${repo}" not found.` });
    }
    if (!res.ok) {
      return respond({ text: `GitHub API error: ${res.status}` });
    }

    const contributors = await res.json();
    if (contributors.length === 0) {
      return respond({ text: `No contributors found for "${repo}".` });
    }

    const lines = contributors.map(
      (c, i) => `*${i + 1}.* ${c.login} — ${c.contributions} contributions`
    );

    await respond({ text: `*Top Contributors: ${repo}*\n${lines.join("\n")}` });
  } catch (err) {
    await respond({ text: `Error fetching contributors: ${err.message}` });
  }
});

const DAY_MS = 86400000;

function fmtDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / DAY_MS);
}

async function fetchAllCommits(repo, sinceIso) {
  const all = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/commits?since=${sinceIso}&per_page=100&page=${page}`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (res.status === 404) return { error: `Repository "${repo}" not found.` };
    if (!res.ok) return { error: `GitHub API error: ${res.status}` };
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return { commits: all };
}

function summarizeCommits(commits, sinceMs) {
  const filtered = commits.filter(
    (c) => new Date(c.commit.author?.date).getTime() >= sinceMs
  );
  const byAuthor = {};
  const byDay = {};
  for (const c of filtered) {
    const author = c.commit.author?.name || "unknown";
    const date = (c.commit.author?.date || "").slice(0, 10);
    byAuthor[author] = (byAuthor[author] || 0) + 1;
    byDay[date] = (byDay[date] || 0) + 1;
  }
  return { filtered, byAuthor, byDay };
}

function topEntries(map, n = 5) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function fmtPeriod(start) {
  return `${fmtDate(start)} → ${fmtDate(new Date())}`;
}

app.command("/github-streak", async ({ command, ack, respond }) => {
  await ack();
  const username = command.text.trim();
  if (!username) {
    return respond({ text: "Please provide a GitHub username. Example: /github-streak torvalds" });
  }

  try {
    const res = await fetch(`https://github.com/users/${encodeURIComponent(username)}/contributions`, {
      headers: { "User-Agent": "github-tracker", Accept: "text/html" }
    });
    if (res.status === 404) {
      return respond({ text: `GitHub user "${username}" not found.` });
    }
    if (!res.ok) {
      return respond({ text: `GitHub API error: ${res.status}` });
    }

    const html = await res.text();

    const totalMatch = html.match(/([\d,]+)\s+contributions?\s+in the last year/);
    const total = totalMatch ? totalMatch[1] : "N/A";

    const levels = {};
    const dateRe = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"/g;
    let m;
    while ((m = dateRe.exec(html)) !== null) {
      levels[m[1]] = parseInt(m[2], 10);
    }

    const dates = Object.keys(levels).sort();
    if (dates.length === 0) {
      return respond({ text: `No contribution data found for "${username}".` });
    }

    const isActive = (d) => (levels[d] || 0) > 0;

    let cursor = new Date();
    if (!isActive(fmtDate(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    let currentStreak = 0;
    while (isActive(fmtDate(cursor))) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    let longestStreak = 0;
    let run = 0;
    let prev = null;
    for (const d of dates) {
      if (isActive(d)) {
        run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
        longestStreak = Math.max(longestStreak, run);
      }
      prev = d;
    }

    await respond({
      text: [
        `*Contribution Streak for @${username}*`,
        `*Current Streak:* ${currentStreak} day${currentStreak === 1 ? "" : "s"}`,
        `*Longest Streak:* ${longestStreak} day${longestStreak === 1 ? "" : "s"}`,
        `*Contributions in the last year:* ${total}`
      ].join("\n")
    });
  } catch (err) {
    await respond({ text: `Error fetching streak: ${err.message}` });
  }
});

app.command("/github-releases", async ({ command, ack, respond }) => {
  await ack();
  const repo = command.text.trim();
  if (!repo) {
    return respond({ text: "Please provide a repository. Example: /github-releases torvalds/linux" });
  }
  if (!repo.includes("/")) {
    return respond({ text: 'Invalid repository format. Use "owner/repo". Example: /github-releases torvalds/linux' });
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/releases?per_page=5`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (res.status === 404) {
      return respond({ text: `Repository "${repo}" not found.` });
    }
    if (!res.ok) {
      return respond({ text: `GitHub API error: ${res.status}` });
    }

    const releases = await res.json();
    if (releases.length === 0) {
      return respond({ text: `No releases found for "${repo}".` });
    }

    const lines = releases.map((r, i) => {
      const tag = r.tag_name || "N/A";
      const date = r.published_at ? r.published_at.slice(0, 10) : "N/A";
      const name = r.name || tag;
      return `*${i + 1}.* ${name} — \`${tag}\`\n      Released: ${date}\n      ${r.html_url}`;
    });

    await respond({ text: `*Recent Releases: ${repo}*\n${lines.join("\n")}` });
  } catch (err) {
    await respond({ text: `Error fetching releases: ${err.message}` });
  }
});

app.command("/github-hot", async ({ command, ack, respond }) => {
  await ack();
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;

  try {
    const res = await fetch(
      `https://api.github.com/search/repositories?q=pushed:%3E${sinceStr}&sort=stars&order=desc&per_page=10`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) {
      return respond({ text: `GitHub API error: ${res.status}` });
    }

    const { items } = await res.json();
    if (!items || items.length === 0) {
      return respond({ text: "No active repositories found." });
    }

    const lines = items.map(
      (r, i) =>
        `*${i + 1}.* ${r.full_name} — ${r.stargazers_count} stars · ${r.forks_count} forks\n      ${r.description || "No description"}\n      ${r.html_url}`
    );

    await respond({ text: `*Most Active Repositories (last 14 days)*\n${lines.join("\n")}` });
  } catch (err) {
    await respond({ text: `Error fetching hot repositories: ${err.message}` });
  }
});

app.command("/github-trending", async ({ command, ack, respond }) => {
  await ack();
  const language = command.text.trim();

  try {
    const url = language
      ? `https://github.com/trending/${encodeURIComponent(language.toLowerCase())}`
      : "https://github.com/trending";
    const res = await fetch(url, {
      headers: { "User-Agent": "github-tracker", Accept: "text/html" }
    });
    if (res.status === 404) {
      return respond({ text: `No trending repositories found for language "${language}".` });
    }
    if (!res.ok) {
      return respond({ text: `Error fetching trending: ${res.status}` });
    }

    const html = await res.text();
    const tRe = /<h2[^>]*class="h3 lh-condensed"[^>]*>[\s\S]*?<a[^>]*href="\/([^"\/]+\/[^"\/]+)"/g;
    let m;
    const repos = [];
    while ((m = tRe.exec(html)) !== null) repos.push(m[1]);

    if (repos.length === 0) {
      return respond({ text: "No trending repositories found." });
    }

    const lines = repos
      .slice(0, 10)
      .map((r, i) => `*${i + 1}.* ${r}\n      https://github.com/${r}`);

    const header = language ? `*Trending Repositories: ${language}*` : "*Trending Repositories Today*";
    await respond({ text: `${header}\n${lines.join("\n")}` });
  } catch (err) {
    await respond({ text: `Error fetching trending: ${err.message}` });
  }
});

app.command("/github-random", async ({ command, ack, respond }) => {
  await ack();

  try {
    const res = await fetch(
      "https://api.github.com/search/repositories?q=stars:%3E50000&sort=stars&order=desc&per_page=100",
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) {
      return respond({ text: `GitHub API error: ${res.status}` });
    }

    const { items } = await res.json();
    if (!items || items.length === 0) {
      return respond({ text: "No repositories found." });
    }

    const repo = items[Math.floor(Math.random() * items.length)];
    await respond({
      text: [
        `*Random Repository:* ${repo.full_name}`,
        `*Description:* ${repo.description || "N/A"}`,
        `*Language:* ${repo.language || "N/A"}`,
        `*Stars:* ${repo.stargazers_count}`,
        `*Forks:* ${repo.forks_count}`,
        `*Open Issues:* ${repo.open_issues_count}`,
        `*Link:* ${repo.html_url}`
      ].join("\n")
    });
  } catch (err) {
    await respond({ text: `Error fetching random repository: ${err.message}` });
  }
});

app.command("/github-search", async ({ command, ack, respond }) => {
  await ack();
  const query = command.text.trim();
  if (!query) {
    return respond({ text: "Please provide a search query. Example: /github-search blockchain" });
  }

  try {
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=5`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) {
      return respond({ text: `GitHub API error: ${res.status}` });
    }

    const { items } = await res.json();
    if (!items || items.length === 0) {
      return respond({ text: `No repositories found for "${query}".` });
    }

    const lines = items.map(
      (r, i) =>
        `*${i + 1}.* ${r.full_name} — ${r.stargazers_count} stars · ${r.forks_count} forks\n      ${r.description || "No description"}\n      ${r.html_url}`
    );

    await respond({ text: `*Search Results for "${query}"*\n${lines.join("\n")}` });
  } catch (err) {
    await respond({ text: `Error searching repositories: ${err.message}` });
  }
});

app.command("/github-compare", async ({ command, ack, respond }) => {
  await ack();
  const [repo1, repo2, ...rest] = command.text.trim().split(/\s+/);
  if (!repo1 || !repo2 || rest.length > 0) {
    return respond({ text: 'Please provide two repositories. Example: /github-compare torvalds/linux facebook/react' });
  }
  if (!repo1.includes("/") || !repo2.includes("/")) {
    return respond({ text: 'Invalid repository format. Use "owner/repo". Example: /github-compare torvalds/linux facebook/react' });
  }

  try {
    const [res1, res2] = await Promise.all([
      fetch(`https://api.github.com/repos/${repo1}`, { headers: { Accept: "application/vnd.github+json" } }),
      fetch(`https://api.github.com/repos/${repo2}`, { headers: { Accept: "application/vnd.github+json" } })
    ]);
    if (res1.status === 404) {
      return respond({ text: `Repository "${repo1}" not found.` });
    }
    if (res2.status === 404) {
      return respond({ text: `Repository "${repo2}" not found.` });
    }
    if (!res1.ok || !res2.ok) {
      return respond({ text: `GitHub API error: ${res1.status}/${res2.status}` });
    }

    const [a, b] = await Promise.all([res1.json(), res2.json()]);
    const fmt = (r) => [
      `*${r.full_name}*`,
      `Stars: ${r.stargazers_count}`,
      `Forks: ${r.forks_count}`,
      `Watchers: ${r.watchers_count}`,
      `Open Issues: ${r.open_issues_count}`,
      `Language: ${r.language || "N/A"}`
    ].join("\n");

    await respond({
      text: [
        "*Repository Comparison*",
        "",
        `_${a.full_name}_`,
        fmt(a),
        "",
        `_${b.full_name}_`,
        fmt(b)
      ].join("\n")
    });
  } catch (err) {
    await respond({ text: `Error comparing repositories: ${err.message}` });
  }
});

app.command("/github-health", async ({ command, ack, respond }) => {
  await ack();
  const repo = command.text.trim();
  if (!repo) {
    return respond({ text: "Please provide a repository. Example: /github-health torvalds/linux" });
  }
  if (!repo.includes("/")) {
    return respond({ text: 'Invalid repository format. Use "owner/repo". Example: /github-health torvalds/linux' });
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (res.status === 404) {
      return respond({ text: `Repository "${repo}" not found.` });
    }
    if (!res.ok) {
      return respond({ text: `GitHub API error: ${res.status}` });
    }

    const r = await res.json();

    const [readmeRes, topicsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${repo}/readme`, { headers: { Accept: "application/vnd.github+json" } }),
      fetch(`https://api.github.com/repos/${repo}/topics`, { headers: { Accept: "application/vnd.github+json" } })
    ]);
    const hasReadme = readmeRes.ok;
    const topics = topicsRes.ok ? (await topicsRes.json()).names || [] : [];

    const metrics = [];

    metrics.push(["Has description", r.description ? 10 : 0, 10]);
    metrics.push(["Has license", r.license ? 10 : 0, 10]);
    metrics.push(["Has README", hasReadme ? 10 : 0, 10]);
    metrics.push(["Has topics", topics.length > 0 ? 10 : 0, 10]);

    const issueRatio = r.open_issues_count / Math.max(r.stargazers_count, 1);
    let issueScore = 10;
    if (issueRatio > 0.5) issueScore = 4;
    else if (issueRatio > 0.25) issueScore = 6;
    else if (issueRatio > 0.1) issueScore = 8;
    metrics.push([`Open issue ratio (${r.open_issues_count}/${r.stargazers_count})`, issueScore, 10]);

    const ageMs = Date.now() - new Date(r.created_at).getTime();
    let ageScore = 5;
    if (ageMs > 2 * 365 * 86400000) ageScore = 10;
    else if (ageMs > 365 * 86400000) ageScore = 8;
    metrics.push(["Repo age (>2y)", ageScore, 10]);

    const staleMs = Date.now() - new Date(r.updated_at).getTime();
    let staleScore = 10;
    if (staleMs > 365 * 86400000) staleScore = 4;
    else if (staleMs > 180 * 86400000) staleScore = 6;
    else if (staleMs > 90 * 86400000) staleScore = 8;
    metrics.push(["Recently updated (<90d)", staleScore, 10]);

    const total = metrics.reduce((sum, [, score]) => sum + score, 0);
    const max = metrics.length * 10;
    const score = Math.round((total / max) * 100);

    let verdict = "Needs attention";
    if (score >= 80) verdict = "Very healthy";
    else if (score >= 60) verdict = "Healthy";
    else if (score >= 40) verdict = "Fair";

    const bars = metrics
      .map(([label, score, maxScore]) => {
        const filled = "▓".repeat(score);
        const empty = "░".repeat(maxScore - score);
        return `${label}\n      ${filled}${empty} ${score}/${maxScore}`;
      })
      .join("\n");

    await respond({
      text: [
        `*Health Score: ${r.full_name}*`,
        `Score: ${score}/100 — ${verdict}`,
        "",
        bars
      ].join("\n")
    });
  } catch (err) {
    await respond({ text: `Error fetching health: ${err.message}` });
  }
});

app.command("/github-milestones", async ({ command, ack, respond }) => {
  await ack();
  const repo = command.text.trim();
  if (!repo) {
    return respond({ text: "Please provide a repository. Example: /github-milestones torvalds/linux" });
  }
  if (!repo.includes("/")) {
    return respond({ text: 'Invalid repository format. Use "owner/repo". Example: /github-milestones torvalds/linux' });
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/milestones?state=all&per_page=10`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (res.status === 404) {
      return respond({ text: `Repository "${repo}" not found.` });
    }
    if (!res.ok) {
      return respond({ text: `GitHub API error: ${res.status}` });
    }

    const milestones = await res.json();
    if (milestones.length === 0) {
      return respond({ text: `No milestones found for "${repo}".` });
    }

    const lines = milestones.map((m, i) => {
      const due = m.due_on ? m.due_on.slice(0, 10) : "No due date";
      const state = m.state === "open" ? "Open" : "Closed";
      return `*${i + 1}.* ${m.title} — ${state}\n      ${m.open_issues} open · ${m.closed_issues} closed · Due: ${due}\n      ${m.html_url}`;
    });

    await respond({ text: `*Milestones: ${repo}*\n${lines.join("\n")}` });
  } catch (err) {
    await respond({ text: `Error fetching milestones: ${err.message}` });
  }
});

app.command("/github-roadmap", async ({ command, ack, respond }) => {
  await ack();
  const repo = command.text.trim();
  if (!repo) {
    return respond({ text: "Please provide a repository. Example: /github-roadmap torvalds/linux" });
  }
  if (!repo.includes("/")) {
    return respond({ text: 'Invalid repository format. Use "owner/repo". Example: /github-roadmap torvalds/linux' });
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/milestones?state=open&per_page=10`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (res.status === 404) {
      return respond({ text: `Repository "${repo}" not found.` });
    }
    if (!res.ok) {
      return respond({ text: `GitHub API error: ${res.status}` });
    }

    const milestones = await res.json();
    const upcoming = milestones
      .filter((m) => m.due_on)
      .sort((a, b) => new Date(a.due_on) - new Date(b.due_on));

    if (upcoming.length === 0) {
      return respond({ text: `No upcoming milestones for "${repo}".` });
    }

    const lines = upcoming.map(
      (m, i) =>
        `*${i + 1}.* ${m.title} — due ${m.due_on.slice(0, 10)}\n      ${m.open_issues} open issues remaining\n      ${m.html_url}`
    );

    await respond({ text: `*Roadmap: ${repo}*\n${lines.join("\n")}` });
  } catch (err) {
    await respond({ text: `Error fetching roadmap: ${err.message}` });
  }
});

app.command("/github-leaderboard", async ({ command, ack, respond }) => {
  await ack();

  try {
    const res = await fetch(
      "https://api.github.com/search/users?q=followers:%3E10000&sort=followers&order=desc&per_page=10",
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) {
      return respond({ text: `GitHub API error: ${res.status}` });
    }

    const { items } = await res.json();

    const users = await Promise.all(
      items.map(async (u) => {
        const detail = await fetch(`https://api.github.com/users/${u.login}`);
        return detail.ok ? detail.json() : null;
      })
    );

    const lines = users
      .filter(Boolean)
      .map(
        (u, i) =>
          `*${i + 1}.* ${u.name ? `${u.name} ` : ""}@${u.login} — ${u.followers} followers · ${u.html_url}`
      );

    await respond({ text: `*Top 10 Most Followed on GitHub*\n${lines.join("\n")}` });
  } catch (err) {
    await respond({ text: `Error fetching leaderboard: ${err.message}` });
  }
});

app.command("/github-weekly", async ({ command, ack, respond }) => {
  await ack();
  const repo = command.text.trim();
  if (!repo) {
    return respond({ text: "Please provide a repository. Example: /github-weekly torvalds/linux" });
  }
  if (!repo.includes("/")) {
    return respond({ text: 'Invalid repository format. Use "owner/repo". Example: /github-weekly torvalds/linux' });
  }

  try {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const { commits, error } = await fetchAllCommits(repo, start.toISOString());
    if (error) return respond({ text: error });

    const { filtered, byAuthor, byDay } = summarizeCommits(commits, start.getTime());
    const days = 7;
    const perDay = filtered.length / days;

    const authors = topEntries(byAuthor).map(
      ([name, count], i) => `*${i + 1}.* ${name} — ${count} commit${count === 1 ? "" : "s"}`
    );
    const daysList = topEntries(byDay).map(
      ([date, count], i) => `*${i + 1}.* ${date} — ${count} commit${count === 1 ? "" : "s"}`
    );

    const lines = [
      `*Weekly Development Report: ${repo}*`,
      `Period: ${fmtPeriod(start)}`,
      `*Commits:* ${filtered.length} (${perDay.toFixed(1)}/day)`,
      `*Contributors:* ${Object.keys(byAuthor).length}`,
      "",
      `*Top Contributors*`,
      ...(authors.length ? authors : ["None"]),
      "",
      `*Most Active Days*`,
      ...(daysList.length ? daysList : ["None"])
    ];

    await respond({ text: lines.join("\n") });
  } catch (err) {
    await respond({ text: `Error fetching weekly report: ${err.message}` });
  }
});

app.command("/github-monthly", async ({ command, ack, respond }) => {
  await ack();
  const repo = command.text.trim();
  if (!repo) {
    return respond({ text: "Please provide a repository. Example: /github-monthly torvalds/linux" });
  }
  if (!repo.includes("/")) {
    return respond({ text: 'Invalid repository format. Use "owner/repo". Example: /github-monthly torvalds/linux' });
  }

  try {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const { commits, error } = await fetchAllCommits(repo, start.toISOString());
    if (error) return respond({ text: error });

    const { filtered, byAuthor, byDay } = summarizeCommits(commits, start.getTime());
    const days = 30;
    const perDay = filtered.length / days;
    const busiest = topEntries(byDay, 1)[0];

    const authors = topEntries(byAuthor, 10).map(
      ([name, count], i) => `*${i + 1}.* ${name} — ${count} commit${count === 1 ? "" : "s"}`
    );

    const lines = [
      `*Monthly Development Report: ${repo}*`,
      `Period: ${fmtPeriod(start)}`,
      `*Commits:* ${filtered.length} (${perDay.toFixed(1)}/day)`,
      `*Contributors:* ${Object.keys(byAuthor).length}`,
      `*Busiest day:* ${busiest ? `${busiest[0]} — ${busiest[1]} commits` : "None"}`,
      "",
      `*Top Contributors*`,
      ...(authors.length ? authors : ["None"])
    ];

    await respond({ text: lines.join("\n") });
  } catch (err) {
    await respond({ text: `Error fetching monthly report: ${err.message}` });
  }
});

app.command("/github-velocity", async ({ command, ack, respond }) => {
  await ack();
  const repo = command.text.trim();
  if (!repo) {
    return respond({ text: "Please provide a repository. Example: /github-velocity torvalds/linux" });
  }
  if (!repo.includes("/")) {
    return respond({ text: 'Invalid repository format. Use "owner/repo". Example: /github-velocity torvalds/linux' });
  }

  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 30);

    const [weekRes, monthRes] = await Promise.all([
      fetchAllCommits(repo, weekStart.toISOString()),
      fetchAllCommits(repo, monthStart.toISOString())
    ]);
    if (weekRes.error) return respond({ text: weekRes.error });
    if (monthRes.error) return respond({ text: monthRes.error });

    const week = summarizeCommits(weekRes.commits, weekStart.getTime());
    const month = summarizeCommits(monthRes.commits, monthStart.getTime());

    const weekRate = (week.filtered.length / 7).toFixed(1);
    const monthRate = (month.filtered.length / 30).toFixed(1);
    const trend = monthRate > weekRate ? "accelerating" : monthRate < weekRate ? "slowing" : "steady";
    const busiest = topEntries(month.byDay, 1)[0];
    const topAuthor = topEntries(month.byAuthor, 1)[0];

    const lines = [
      `*Development Velocity: ${repo}*`,
      `*Last 7 days:* ${week.filtered.length} commits · ${weekRate}/day`,
      `*Last 30 days:* ${month.filtered.length} commits · ${monthRate}/day`,
      `*Trend:* ${trend}`,
      `*Peak day (30d):* ${busiest ? `${busiest[0]} — ${busiest[1]} commits` : "None"}`,
      `*Most active (30d):* ${topAuthor ? `${topAuthor[0]} — ${topAuthor[1]} commits` : "None"}`
    ];

    await respond({ text: lines.join("\n") });
  } catch (err) {
    await respond({ text: `Error fetching velocity: ${err.message}` });
  }
});

app.command("/github-digest", async ({ command, ack, respond }) => {
  await ack();
  const repo = command.text.trim();
  if (!repo) {
    return respond({ text: "Please provide a repository. Example: /github-digest torvalds/linux" });
  }
  if (!repo.includes("/")) {
    return respond({ text: 'Invalid repository format. Use "owner/repo". Example: /github-digest torvalds/linux' });
  }

  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const [repoRes, commitRes, prRes, issueRes, releaseRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${repo}`, { headers: { Accept: "application/vnd.github+json" } }),
      fetchAllCommits(repo, weekStart.toISOString()),
      fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(`repo:${repo} type:pr state:open`)}`, { headers: { Accept: "application/vnd.github+json" } }),
      fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(`repo:${repo} type:issue state:open`)}`, { headers: { Accept: "application/vnd.github+json" } }),
      fetch(`https://api.github.com/repos/${repo}/releases?per_page=3`, { headers: { Accept: "application/vnd.github+json" } })
    ]);

    if (repoRes.status === 404) return respond({ text: `Repository "${repo}" not found.` });
    if (commitRes.error) return respond({ text: commitRes.error });
    if (!repoRes.ok) return respond({ text: `GitHub API error: ${repoRes.status}` });

    const r = await repoRes.json();
    const { filtered, byAuthor } = summarizeCommits(commitRes.commits, weekStart.getTime());
    const prCount = prRes.ok ? (await prRes.json()).total_count : "N/A";
    const issueCount = issueRes.ok ? (await issueRes.json()).total_count : "N/A";
    const releases = releaseRes.ok ? await releaseRes.json() : [];

    const recentCommits = filtered.slice(0, 5).map((c, i) => {
      const message = (c.commit.message || "").split("\n")[0];
      const author = c.commit.author?.name || "unknown";
      return `*${i + 1}.* \`${c.sha.slice(0, 7)}\` ${message}\n      ${author} · ${(c.commit.author?.date || "").slice(0, 10)}`;
    });

    const releaseLines = releases.map((rel, i) => `*${i + 1}.* ${rel.name || rel.tag_name} — \`${rel.tag_name}\` (${(rel.published_at || "").slice(0, 10)})`);

    const lines = [
      `*Activity Digest: ${repo}*`,
      `*Repo:* ${r.stargazers_count} stars · ${r.forks_count} forks · ${r.open_issues_count} open issues`,
      `*Commits (7d):* ${filtered.length} by ${Object.keys(byAuthor).length} contributors`,
      `*Open PRs:* ${prCount}`,
      `*Open Issues:* ${issueCount}`,
      "",
      `*Recent Releases*`,
      ...(releaseLines.length ? releaseLines : ["None"]),
      "",
      `*Recent Commits*`,
      ...(recentCommits.length ? recentCommits : ["None"])
    ];

    await respond({ text: lines.join("\n") });
  } catch (err) {
    await respond({ text: `Error fetching digest: ${err.message}` });
  }
});

app.command("/github-help", async ({ ack, respond }) => {
  await ack();
  const commands = [
    "`/github-user <username>` — Show GitHub user profile",
    "`/github-repo <owner/repo>` — Show repository info",
    "`/github-activity <owner/repo>` — Recent commits in a repo",
    "`/github-contributors <owner/repo>` — Top contributors",
    "`/github-streak <username>` — Contribution streak",
    "`/github-releases <owner/repo>` — Recent releases",
    "`/github-hot` — Most active repositories (last 14 days)",
    "`/github-trending [language]` — Trending repositories",
    "`/github-random` — Pick a random repository",
    "`/github-search <query>` — Search GitHub repositories",
    "`/github-compare <repo1> <repo2>` — Compare two repositories",
    "`/github-health <owner/repo>` — Repository health score",
    "`/github-milestones` — Milestones for the configured repo",
    "`/github-roadmap` — Upcoming milestones for the configured repo",
    "`/github-leaderboard` — Top 10 most followed GitHub users",
    "`/github-weekly <owner/repo>` — Weekly development report",
    "`/github-monthly <owner/repo>` — Monthly report",
    "`/github-velocity <owner/repo>` — Development velocity",
    "`/github-digest <owner/repo>` — Activity digest",
    "`/github-tracker-ping` — Bot latency check"
  ].join("\n");

  await respond({ text: `*GitHub Tracker Commands*\n${commands}` });
});

const http = require("http");
const PORT = process.env.PORT || 3000;

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("GitHub Tracker is running");
  })
  .listen(PORT, () => console.log(`Health server listening on port ${PORT}`));

(async () => {
  await app.start();
  console.log("bot is running!");
})();