# GitHub Tracker

A Slack bot that brings GitHub data straight into your workspace. Query users, repositories, streaks, trends, releases, health scores, development reports and more using slash commands.

## Features

- User profiles, repository info, recent activity and top contributors
- Contribution streaks and daily GitHub contribution data
- Trending, hot, random and searchable repositories
- Repository health scoring and issue ratios
- Weekly, monthly, velocity and digest development reports
- Compare repositories side by side
- Runs entirely in Slack Socket Mode, no public web server required

## Requirements

- Node.js 18 or later
- A Slack app with Socket Mode enabled and a bot token
- A GitHub API token (optional, recommended to avoid rate limits)

## Setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:

   ```
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_APP_TOKEN=xapp-1-your-app-token
   GITHUB_TOKEN=your-github-token (optional)
   ```

3. Start the bot:

   ```bash
   npm start
   ```

4. In your Slack app settings (api.slack.com), create slash commands and point them at this bot. Enable Socket Mode in the app configuration.

## Commands

| Command | Description |
| --- | --- |
| `/github-user <username>` | Show a GitHub user profile |
| `/github-repo <owner/repo>` | Show repository info |
| `/github-activity <owner/repo>` | Recent commits in a repository |
| `/github-contributors <owner/repo>` | Top contributors |
| `/github-streak <username>` | Contribution streak |
| `/github-releases <owner/repo>` | Recent releases |
| `/github-hot` | Most active repositories in the last 14 days |
| `/github-trending [language]` | Trending repositories |
| `/github-random` | Pick a random repository |
| `/github-search <query>` | Search GitHub repositories |
| `/github-compare <repo1> <repo2>` | Compare two repositories |
| `/github-health <owner/repo>` | Repository health score |
| `/github-milestones <owner/repo>` | Open and closed milestones |
| `/github-roadmap <owner/repo>` | Upcoming milestones |
| `/github-leaderboard` | Top 10 most followed GitHub users |
| `/github-weekly <owner/repo>` | Weekly development report |
| `/github-monthly <owner/repo>` | Monthly development report |
| `/github-velocity <owner/repo>` | Development velocity |
| `/github-digest <owner/repo>` | Activity digest |
| `/github-tracker-ping` | Bot latency check |
| `/github-help` | List all commands |

## Running 24/7

The bot runs in Socket Mode, so it needs an always-on host rather than a public URL. Fly.io is a good free option.

1. Install the Fly CLI and sign in:

   ```bash
   fly auth login
   ```

2. Launch the app (creates `fly.toml`):

   ```bash
   fly launch --no-deploy
   ```

3. Set the secrets:

   ```bash
   fly secrets set SLACK_BOT_TOKEN="xoxb-..." SLACK_APP_TOKEN="xapp-1-..."
   ```

4. Deploy:

   ```bash
   fly deploy
   ```

5. Verify with `fly logs` and test `/github-tracker-ping` in Slack.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `SLACK_BOT_TOKEN` | Yes | Slack bot token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | Yes | Slack app-level token for Socket Mode (`xapp-1-...`) |
| `GITHUB_TOKEN` | No | GitHub personal access token for higher API rate limits |

## License

ISC