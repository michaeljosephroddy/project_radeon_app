```md
# Store Publishing Readiness MVP

## Summary

Implement the minimum publishable safety/legal feature set across the Expo app and Go backend. Scope is store-readiness MVP, not a full moderator dashboard.

Chosen defaults:

- Require 18+ accounts at launch.
- Remove the placeholder identity verification step.
- Add legal/support links through configuration placeholders.
- Persist user-facing content reports in the backend.
- Use OpenAI moderation for text and images.
- Fail closed when moderation is unavailable or flags content.

## Implementation

1. Add backend content reports.
   - Add a `content_reports` table and authenticated `POST /reports`.
   - Support `feed_post`, `feed_share`, `feed_comment`, `feed_share_comment`, `chat`, and `message` targets.
   - Keep existing user reports and group reports unchanged.

2. Add backend moderation.
   - Add `internal/moderation` with a provider interface, no-op disabled provider, and OpenAI provider.
   - Configure with `MODERATION_ENABLED`, `OPENAI_API_KEY`, `OPENAI_MODERATION_MODEL`, and timeout env.
   - Moderate text before saving public/user-generated text.
   - Moderate images before uploads are stored or returned to the app.
   - Return validation errors when content is blocked or moderation is unavailable while enabled.

3. Add launch safety in the app.
   - Require birth date and legal acceptance on registration.
   - Block under-18 registration on the client and backend.
   - Add legal/support links in Settings.
   - Remove `IdentityVerificationStep` from onboarding.
   - Add report actions to feed items, comments, chats, and messages.

4. Validate.
   - Run backend tests with `go test ./...`.
   - Run app typecheck with `npm run typecheck`.
   - Manually verify legal links, delete account, report, block, and moderation error flows.

## Notes

This plan intentionally keeps global report review operationally manual through database/admin access. A polished global moderation dashboard is a follow-up.
```
