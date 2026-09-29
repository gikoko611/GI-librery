# G.I Bookshelf
## What we're building
A public PDF library where anyone can discover, read and download books, with secure admin-only catalog management.
## Who reads this
Public visitors browsing books; administrators manage the catalog.
## Pages
- Home — featured, recent and popular books
- Library / Categories — browse, search and filter
- Book / Reader — details, online reading and downloads
- Admin — sign in, dashboard and book management
## Look & feel
Ink-dark bookshelf with violet and cyan accents, editorial serif headlines, tactile book covers and mobile-first controls.
## Login & data
No public accounts; persistent book metadata and admin authentication. Favorites, reader position and preferences stay in local browser storage.
## Assumptions
- Sample book listings are metadata-only; no copyrighted PDF files are bundled.
- Administrators will need a server-configured credential; no default public signup or hardcoded secrets.
- Uploads use a safe URL/configuration path when external object storage is not provisioned.
