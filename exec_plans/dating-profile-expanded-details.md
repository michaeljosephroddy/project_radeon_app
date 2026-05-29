# Dating Profile Expanded Details

## Goal

Expand dating profiles with common optional profile details and refactor the edit tab so photos remain visible while other sections open into focused editors.

## Scope

- Add optional dating profile fields in the Go backend and API responses.
- Add frontend API types, save support, compact edit rows, focused section editors, and preview rendering.
- Keep required fields limited to photos, bio, interests, dating intentions, and interested in.

## Options

- Dating intentions: long-term relationship, life partner, short-term open to long-term, still figuring it out, new sober connections.
- Relationship type: monogamous, open relationship, other.
- Interested in: men, women, everyone.
- Gender: woman, man, non-binary, other.
- Sexuality: straight, gay, lesbian, bisexual, other.
- Pronouns: she/her, he/him, they/them, other.
- Ethnicity: Asian, Black, Hispanic / Latino, Middle Eastern, Mixed, Native / Indigenous, White, Other.
- Children: have children, have children and want more, have children and do not want more, want children, do not want children, open to children, not sure.
- Pets: have pets, want pets, like pets, allergic to pets, not a pet person.
- Religious beliefs: Agnostic, Atheist, Buddhist, Christian, Hindu, Jewish, Muslim, Sikh, Spiritual, Other.
- Languages spoken: broad common-language multi-select, max 5.
- Political view: Liberal, Moderate, Conservative, Not political, Other.

## Implementation Steps

- [x] Backend migration for new fields and constraints.
- [x] Backend dating types, update handler validation, store update/query scan changes.
- [x] App API types and normalization.
- [x] App editor draft state, save payload, preview details.
- [x] Compact edit rows below the photo grid and focused section editors.
- [x] Validation: backend tests, local migration, and app typecheck.
