# Direct plan

## Card: bookmark-storage

Bookmark CLI for one user. Store a bookmark by stable id, retrieve the same HTTPS URL for that stable id, and return no value for an unknown id.

Principle: save once, retrieve exactly.

Acceptance boundary: only HTTPS URLs are inside the acceptance boundary.

Unknowns:
- Storage location: unknown
- Retention period: unknown
- Import support: unknown
