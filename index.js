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