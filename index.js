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

app.command("/user", async ({ command, ack, respond }) => {
  await ack();
  const username = command.text.trim();
  if (!username) {
    return respond({ text: "Please provide a GitHub username. Example: /user torvalds" });
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

(async () => {
  await app.start();
  console.log("bot is running!");
})();