# TurnoYa Constitution

## Core Principles

### I. Business Rules Are Test-Covered (NON-NEGOTIABLE)
Every business rule defined in a feature spec (appointment duration, overlap prevention, active
appointment limit, minimum booking notice, 24-hour change window, consecutive no-show lock) MUST
have at least one automated test that exercises the rule at its boundary (e.g. exactly 24 h, 2 h,
3 appointments, 3 no-shows) and one that exercises a violation. Rule logic MUST live in a domain
layer that is testable without HTTP or a real clock. A change to a rule without a matching test
change MUST NOT be merged.
Rationale: the product exists to eliminate duplicate and forgotten appointments; those rules are
the product.

### II. Input Validation at the Boundary
Every value that enters the system (forms, query strings, headers, stored text rendered back) MUST
be validated and normalized at the boundary and escaped on output. Passwords MUST be stored only as
salted slow hashes, sessions MUST use HttpOnly cookies, and every state-changing action MUST check
the caller's role and ownership of the target record server-side. Errors shown to users MUST be
actionable and MUST NOT leak internals.
Rationale: the system holds personal data of patients; authorization mistakes are the highest
impact failure.

### III. Basic Accessibility
Every screen MUST be usable with keyboard only, use semantic HTML (labels bound to inputs,
headings in order, tables with headers), keep a text contrast of at least WCAG AA, and never convey
status by color alone. Forms MUST announce validation errors in text next to the field.
Rationale: patients include elderly and low-vision users; this is cheap to do early and costly to
retrofit.

### IV. Simplicity and Minimal Dependencies
A third-party dependency MUST be justified in the plan's Complexity Tracking table (what it does,
why the platform/standard library cannot). Prefer the standard library, server-rendered pages and
one data store. No feature outside the active spec's scope (v1 excludes payments, clinical
records, telemedicine, mobile app, insurance integration) MAY be built.
Rationale: small clinic, small team; every dependency is a maintenance and security liability.

### V. Explicit Time Handling
All instants MUST be stored in UTC and all business decisions (24 h window, 2 h notice, reminders,
"today's agenda", working hours) MUST be computed against the clinic's configured time zone through
a single injectable clock/time module. Code MUST NOT read the system clock directly outside that
module.
Rationale: nearly every rule is time-relative; an injectable clock is what makes Principle I
testable.

### VI. Reliable, Idempotent Notifications
Confirmation, change, cancellation and reminder messages MUST be generated from the appointment
state, recorded in an outbox before delivery, and be idempotent (a reminder is sent at most once
per appointment and time slot). A delivery failure MUST NOT roll back the booking and MUST be
retriable.
Rationale: reminders reduce no-shows only if they are neither missed nor duplicated.

## Additional Constraints

- v1 scope is the TurnoYa spec; out of scope: payments, medical history, telemedicine, mobile app,
  insurance integration.
- Personal data (name, email, appointment history) MUST NOT appear in logs; use record ids.
- The application MUST run locally with a single documented command and seed data for a demo.
- Language of the user interface: Spanish. Code identifiers and technical docs: English or Spanish,
  consistent within a module.

## Development Workflow

- Spec-Driven Development order is mandatory: constitution → specify → clarify → plan → tasks →
  implement. Code MUST trace to a task, a task to a requirement.
- Each user story MUST be independently testable and deliverable in priority order (P1 first).
- Tests for business rules (Principle I) are written before the implementation they cover.
- The full automated test suite MUST pass before a story is considered done.
- Every plan MUST include a Constitution Check; violations require written justification.

## Governance

This constitution supersedes other practices. Amendments require a written change with rationale,
a version bump and a review of existing specs/plans for conflicts. Versioning follows semantic
versioning: MAJOR for removed or redefined principles, MINOR for added principles or materially
expanded guidance, PATCH for clarifications. Every plan and review MUST verify compliance with the
principles above; unjustified complexity MUST be rejected.

**Version**: 1.0.0 | **Ratified**: 2026-10-29 | **Last Amended**: 2026-10-29
