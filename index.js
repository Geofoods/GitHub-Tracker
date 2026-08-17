require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { App } = require("@slack/bolt");

const LEADERBOARD_FILE = path.join(__dirname, "leaderboard.json");

function loadLeaderboard() {
  try {
    return JSON.parse(fs.readFileSync(LEADERBOARD_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveLeaderboard(data) {
  fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(data, null, 2));
}

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

    const leaderboard = loadLeaderboard();
    leaderboard[data.login] = {
      name: data.name || data.login,
      followers: data.followers,
      public_repos: data.public_repos,
      updated_at: new Date().toISOString()
    };
    saveLeaderboard(leaderboard);

    await respond({ text: stats });
  } catch (err) {
    await respond({ text: `Error fetching GitHub user: ${err.message}` });
  }
});

app.command("/github-command", async ({ command, ack, respond }) => {
  await ack();
  const leaderboard = loadLeaderboard();
  const entries = Object.entries(leaderboard)
    .sort((a, b) => b[1].followers - a[1].followers)
    .slice(0, 10);

  if (entries.length === 0) {
    return respond({ text: "No users tracked yet. Run /user <github-username> to add someone to the leaderboard." });
  }

  const lines = entries.map(
    ([username, s], i) =>
      `*${i + 1}.* ${s.name || username} (@${username}) — ${s.followers} followers · ${s.public_repos} repos`
  );

  await respond({ text: `*GitHub Leaderboard*\n${lines.join("\n")}` });
});

(async () => {
  await app.start();
  console.log("bot is running!");
})();