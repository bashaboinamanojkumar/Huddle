# Notification Settings Navigation Design

## Goal

Make the existing notification settings page discoverable without crowding Huddle's five-item bottom navigation. Users must be able to reach `/app/settings` from both their profile and the notification inbox.

## Current state

The notification settings experience already exists at `/app/settings` and includes Push categories, quiet hours, timezone, daily cap, and current-device registration. The application header links the notification bell to `/app/notifications`, but neither the Profile page nor the Notifications page links to the settings route. The result is a complete settings page that users cannot discover through the interface.

## Approved design

### Profile entry point

Add a glass-card `Settings` section immediately after `Fit preferences` and before `Badges` on `/app/profile`.

The section contains one full-width link row:

- a settings/gear icon;
- the label `Notification settings`;
- helper text `Push, quiet hours, and device controls`;
- a right-facing chevron;
- destination `/app/settings`.

The complete row is the interactive target. It follows the existing glass-card, rounded-corner, secondary-accent, and white-text visual language. Placing it near the top of Profile makes settings discoverable without mixing account controls into the safety or pilot sections.

### Notification inbox entry point

Add a compact settings shortcut at the right side of the `/app/notifications` page header. It links to `/app/settings` and uses a settings icon with the accessible name `Notification settings`.

This contextual shortcut lets a user move directly from reading notifications to changing delivery preferences. It must have a visible focus state and a touch target of at least 44 by 44 CSS pixels.

### Navigation boundaries

- Keep the five existing bottom-navigation destinations unchanged.
- Do not add a separate general account-settings route or menu.
- Do not change the notification preference controls, database schema, Push registration logic, service worker, Edge Function, runtime rollout percentage, or delivery behavior.
- Do not rename `/app/settings` in this change.

## Component and data flow

Both additions are ordinary Next.js `Link` components that navigate to the existing settings route. They introduce no new state, provider, API request, or database access.

The Profile page owns the primary entry point because it is the established location for user-specific controls. The Notifications page owns the contextual shortcut because it is the nearest task-specific route. The existing `NotificationSettings` component remains the single implementation of all notification preferences.

## Accessibility and responsive behavior

- The Profile row exposes descriptive visible text and is fully keyboard focusable.
- The inbox shortcut has `aria-label="Notification settings"` if its visible treatment is icon-only.
- Both links retain visible hover, active, and focus-visible feedback consistent with existing controls.
- The links must fit the current mobile-width layout without horizontal overflow.
- The inbox title remains readable and does not collide with the shortcut at narrow widths.

## Error handling

No new asynchronous work is introduced. Standard Next.js navigation handles route loading. Existing settings loading, save, permission, subscription, and error states remain unchanged.

## Testing and acceptance criteria

The change is accepted when:

- Profile shows a clearly labeled `Notification settings` row in a `Settings` card and its link targets `/app/settings`.
- The Notifications header shows an accessible settings shortcut targeting `/app/settings`.
- The bottom navigation still contains exactly its existing five destinations.
- Both entry points work at the application's mobile viewport without overlap or horizontal scrolling.
- Existing notification settings behavior is unchanged.
- Focused automated tests cover both links and their accessible names where the current test structure supports page rendering.
- ESLint, TypeScript, relevant tests, and the production build pass.

## Delivery workflow

Implement this change on `feature/settings-navigation`, created from merged `origin/main` commit `89399b5bbfa161bee905876b444ab35328906f4e`. Commits use the repository's configured user identity and contain no automated co-author attribution.
