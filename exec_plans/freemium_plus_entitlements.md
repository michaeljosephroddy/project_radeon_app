# Freemium And Plus Entitlement Plan

## Summary

Use one paid tier: **SoberSpace Plus**. Free keeps the app useful, safe, and community-focused. Plus unlocks organizer tools and higher-signal dating/discovery upgrades.

A user is Plus only when `subscription_tier = 'plus'` and `subscription_status = 'active'`; everyone else is Free.

Billing provider, pricing, checkout, receipt validation, and webhooks are separate future work.

## Free Features

Free users get:

- Account, onboarding, profile editing, avatar, interests, sobriety info, and location.
- Feed: view, post, comment, react, share, hide, and mute authors.
- Groups: discover, join/request access, create groups, post, comment, react, invite, report, admin/moderation tools.
- Peer support: create requests, view requests, offer support, accept/decline offers, public replies/comments, support chats, and close own requests.
- Recovery meetings: full finder, filters, location suggestions, and detail views.
- Meetups: discover, view details, RSVP, waitlist, view attendees/waitlist.
- Existing meetup organizers who lose Plus can still edit, cancel, or delete their existing meetups.
- Chats: direct, group, support, and dating match chats.
- Safety: block, unblock, report, delete account.
- Notifications: inbox, preferences, devices, read/read-all.
- Dating: opt in, browse dating-enabled users, pass unlimited, send **10 likes/day**, match when mutual, and chat with matches.
- People/dating discovery free filters:
  - distance
  - age range
  - gender
  - broaden if no exact matches

## Plus Features

Plus users get everything in Free, plus:

- Become a meetup organizer:
  - create new meetups
  - upload meetup cover images
  - edit/cancel/delete own meetups
  - add co-hosts
  - manage capacity, waitlist, and attendance settings
- Dating upgrades:
  - unlimited likes
  - full "Users who liked you" list
  - dating priority visibility/ranking
- Advanced discovery filters:
  - shared interests
  - sobriety duration
  - verified profiles only, once identity verification is live
- Plus member indicator wherever `is_plus` is already available.

## Explicit Non-Plus Areas

Do not paywall:

- Peer support priority or urgent support visibility.
- Recovery meeting access.
- Meetup discovery, RSVP, waitlist, or attendance views.
- Safety, reporting, blocking, or account deletion.
- Basic feed, groups, posting, comments, or core chat.

Do not add these discovery filters:

- intent
- has profile photo
- new members
- profile completeness / quality score
- liked-you as a discovery filter

`Liked you` remains a separate Plus dating feature.

## Implementation Rules

- Backend must enforce all Plus entitlements; app gating is only UX.
- Add shared entitlements derived from existing subscription fields:
  - `can_create_meetups`
  - `can_upload_meetup_images`
  - `can_view_dating_likes`
  - `can_use_advanced_discovery_filters`
  - `has_unlimited_dating_likes`
  - `has_dating_priority`
  - `dating_daily_like_limit`
- Enforce Plus on:
  - `POST /meetups`
  - `POST /meetups/images`
  - dating likes beyond 10/day
  - full dating likes list
  - Plus-only discovery filters
- Free users submitting Plus-only actions should receive a clear paywall/entitlement error.
- App should show upgrade prompts for:
  - create meetup
  - meetup image upload
  - daily dating like limit reached
  - likes-you list
  - Plus-only discovery filters
- Remove intent from discovery filter UI/model because people discovery and dating discovery are separate surfaces.

## Test Plan

- Free user can use feed, groups, support, recovery meetings, meetup discovery, RSVP, chats, notifications, and safety tools.
- Free user cannot create a meetup or upload meetup cover images.
- Plus user can create meetups and upload meetup cover images.
- Lapsed organizer can edit/cancel/delete existing meetups but cannot create new ones.
- Free user can send 10 dating likes/day; 11th returns paywall/limit response.
- Plus user can like beyond 10/day.
- Free user cannot open full likes-you list.
- Plus user can open full likes-you list.
- Free user can apply distance, age, gender, and broaden filters.
- Free user cannot apply shared interests or sobriety duration.
- Plus user can apply all available filters.
- Dating discovery only shows dating-enabled users.
- App typecheck passes with `npm run typecheck`.
- Backend test suite passes with `go test ./...`.

## Assumptions

- One paid tier only: **Plus**.
- Identity verification is not live yet, so `verified profiles only` is planned but not implemented in v1.
- Plus monetizes organizer capability and better discovery, not safety or recovery access.
