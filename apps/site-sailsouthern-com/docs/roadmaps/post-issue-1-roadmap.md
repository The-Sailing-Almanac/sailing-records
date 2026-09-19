# Post-Issue 1 Roadmap

## Phase 13: Issue 2 Refinement
- Improve candidate selection thresholds.
- Implement social and analytics credentials verification once provided.
- Refine layout templates from initial Issue 1 reader feedback.

## Phase 14: Social Activation
- Enable and test automated Mastodon, Nostr, and Bluesky publishing pipelines.
- Verify platform character limits and link formatting on live channels.

## Phase 15: Analytics & Monitoring
- Activate server-side GA4 Measurement Protocol tracking.
- Create dashboard analytics stream view.

## Phase 16: Downstream Community & Workspace Adapters (Planned)
This phase introduces downstream distribution adapters to push updates to community channels and workspace environments.
*Note: These adapters are planned, not yet implemented, and are not required for the Issue 1 beta launch. The repository and database remain the canonical sources of truth; these integrations serve purely as downstream distribution endpoints.*

- **Telegram Channel Integration:** Broadcast newsletter summaries and micro-editions to Telegram channels.
  - *Implementation Note:* Will utilize the Telegram Bot API for automated channel posting.
- **Discord Channel Integration:** Push publishing run notifications and link summaries to target Discord servers.
  - *Implementation Note:* Will use incoming Discord Webhooks to post rich embed cards.
- **Slack Workspace Integration:** Distribute daily editions and operations logs to Slack workspaces.
  - *Implementation Note:* Will use Slack Incoming Webhooks to publish formatted markdown blocks.
