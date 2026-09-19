# 12. Branch: `feat/competitor-radar-search`

**Feature Description:** Geographic search for competitors around a specific business.
**Business Goal:** Understand local market density and identify new prospects.
**Frontend Tasks:** Map UI and radius slider. List view of search results.
**Backend Tasks:** Integrate Maps API to perform bounded radial searches.
**Database Tasks:** Create `Competitor` table.
**AI Tasks:** N/A
**Integrations:** Google Places API.
**Acceptance Criteria:** Entering "2km" returns all businesses matching the client's industry in that radius.
**Dependencies:** None

# 2. Branch: `feat/global-ai-chatbot`

**Feature Description:** Context-aware floating AI chatbot widget.
**Business Goal:** Provide immediate AI assistance tied to the user's current screen context.
**Frontend Tasks:** Implement floating chat widget, capture current route context, handle local UI chat state.
**Backend Tasks:** Setup basic chatbot intent endpoint.
**Database Tasks:** N/A
**AI Tasks:** Basic intent routing logic for the chatbot.
**Integrations:** N/A
**Acceptance Criteria:** Chat button appears on every page and opens an interactive chat window.
**Dependencies:** `feat/design-system-and-themes`
