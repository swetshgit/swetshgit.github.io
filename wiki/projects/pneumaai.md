# PneumaAI

*PneumaAI is a burnout-aware scheduling assistant that combines conversational planning, a personal calendar, and user context to make room for work, daily routines, and recovery.*

## Introduction

PneumaAI starts from a simple observation: an empty calendar slot does not always mean someone has the energy to take on more work. Exams, deadlines, meetings, meals, and recovery compete for the same day, while a person's capacity can change from one day to the next.

The project explores a calendar that responds to those circumstances. Users can describe what they need to do, explain how they are feeling, and ask for changes in ordinary language. A chat panel sits alongside a month calendar and a day timeline, connecting the conversation to visible schedule changes.

The current implementation is a web MVP. Its longer-term direction is a passive time shield: an assistant that helps identify overload and protect recovery before the user has to audit every calendar entry manually.

## Problem statement

Conventional calendars record when activities happen, but leave much of the planning work to the user. Someone who feels exhausted still has to decide what can move, find the relevant entries, and rebuild their day. A generic chatbot can offer advice, but needs access to the actual schedule and personal constraints to make that advice actionable.

PneumaAI brings those pieces together. The goal is to make scheduling sensitive to self-reported energy, sleep patterns, recurring commitments, and planning preferences, while keeping the resulting plan visible in a familiar calendar interface.

## What the application does

- **Personal onboarding:** collects a preferred name, age group, profession, typical sleep, baseline energy, planning habits, and preferred AI guidance style. Users also choose meal frequency, event reminder lead time, and a check-in preference.
- **Conversational scheduling:** turns natural-language requests into calendar events or instant reminders. Chat requests can also move or delete existing entries.
- **Recurring routines:** interprets descriptions such as "Tennis every Wednesday at 7 PM for 90 minutes" into structured weekly commitments that users can review during onboarding.
- **Calendar and timeline:** displays saved items by full date, with a month overview and a detailed day view. Suggested meal windows and weekly commitments appear as tentative routine blocks.
- **Manual planning:** supports adding events and reminders, and deleting saved calendar items. Manual event creation checks duration and prevents a third simultaneous event from being added.
- **In-app event reminders:** displays an upcoming-event popup while the application is running, using the selected reminder lead time.
- **Profile and memory controls:** lets users change preferences, clear AI habit memory, or reset their profile and calendar data. The account-reset flow asks for password verification and returns the user to onboarding.

These capabilities reflect the implementation in the repository. The check-in preference is supplied to the model as context; it is not a background check-in service.

## Architecture

| Layer | Implementation | Responsibility |
| --- | --- | --- |
| Application interface | React 19, TypeScript, Vite | Authentication screens, onboarding, chat, profile settings, calendar, and timeline |
| API | Python, FastAPI, Pydantic | Session verification, profile and calendar operations, AI context assembly, and response processing |
| Identity and persistence | Supabase Auth and Postgres | User accounts, profile preferences, habit summaries, and calendar items |
| Language model | Gemini 3.1 Flash-Lite, as configured in the backend | Schedule reasoning, recurring-commitment parsing, and structured calendar operations |
| Public website | HTML, CSS, JavaScript | Separate landing page for the product |

The frontend sends the Supabase access token with API requests. The backend verifies the session through Supabase Auth, scopes database operations to the authenticated user, and creates database clients carrying that user's token so row-level policies can apply. Backend credentials and the Gemini API key stay on the server.

The main data entities are `profiles` and `calendar_items`. Profiles hold preferences, weekly commitments, onboarding status, and short-term and long-term habit summaries. Calendar items hold the owner, title, description, start and end timestamps, and category. SQL migrations extend the profile schema for onboarding, routines, and reminder settings.

## Context injection instead of per-user model training

The central AI design is personalization through context injection. PneumaAI assembles relevant user information for each scheduling request rather than training a separate model for each person.

For a request to `POST /analyze-schedule`, the backend combines:

- Profile preferences, including typical sleep, baseline energy, meals, and fixed weekly commitments.
- Stored short-term and long-term habit summaries.
- The last ten chat messages supplied by the frontend.
- Up to 200 calendar entries within a 90-day horizon beginning at the user's supplied local midnight.
- The current wall-clock datetime and the new request.

The prompt asks the model to prioritize realistic plans and recovery, adapt its tone to the chosen guidance style, and treat profile values as planning baselines. For illness or exhaustion, it instructs the assistant to ask about reshuffling the schedule before making recovery-related changes.

The model returns structured JSON containing an explanation, proposed additions, updates, deletions, and a memory patch. The backend parses the response and sanitizes proposed events, including title length, category, timestamps, duration, and the number of additions. New-event proposals are capped at 40 per response.

Existing-event updates and deletions are restricted to IDs in the retrieved calendar snapshot and scoped to the authenticated user. Move requests suppress new-event proposals, helping avoid creating a duplicate when the intended action is to reschedule an existing item.

## From conversation to calendar

For a request such as "Schedule a study session tomorrow afternoon," the frontend submits the message, recent conversation, and local datetime. The backend retrieves context and asks Gemini for structured scheduling output. Returned additions are then saved by the frontend through `POST /calendar/add`, and the saved records are merged into the calendar using their database IDs.

For moves and deletions, the analysis endpoint applies valid returned operations directly to the database and reports the changed records or deleted IDs to the frontend. The interface then reconciles its calendar state with those results.

The current flow applies returned additions and valid modifications during the request cycle. A separate preview-and-confirm step for every AI calendar change remains a future improvement.

## Engineering trade-offs

**Personalization needs more than conversation history.** A bounded calendar snapshot, explicit preferences, and compact habit summaries provide continuity across requests. Habit summaries are generated by the model and stored with the profile; they are not independently measured behavioral evidence.

**Natural-language intent needs structured operations.** Adding, moving, and deleting require different handling. Stable event IDs and an explicit operation type help connect a conversational request to the correct saved record, while ambiguous targets can be sent back for clarification.

**A readable schedule needs clear time semantics.** The frontend preserves full date keys and local wall-clock times, and merges saved items by ID. A complete timezone and daylight-saving policy remains an area for further work, especially before external calendar synchronization.

**Visible routines and saved events have different roles.** Meal windows and recurring commitments are generated from profile settings for display as tentative blocks. They are not all stored as individual calendar records. A stronger scheduling constraint layer would make conflict handling consistent across these routines, manual entries, and AI-generated changes.

## Current status and next steps

The repository implements an integrated web MVP spanning authentication, onboarding, contextual AI requests, persistent calendar operations, and calendar rendering. It does not provide a benchmark study, user evaluation, or measured evidence of reduced burnout, so the project's outcome is currently a working product implementation rather than a validated wellbeing result.

The next steps are to evaluate scheduling quality and conflict handling, introduce explicit review of AI changes, and strengthen time handling and structured-output validation. The broader product direction also includes external calendar synchronization, proactive overload detection, and a mobile or desktop companion.

Google or iOS Calendar sync, wearable data ingestion, a quantitative fatigue score, and background push notifications are not implemented in the inspected source. Current event notifications are in-app popups, and the public landing page's waitlist form is a visual demo rather than a stored-submission workflow.

## Links and resources

- [PneumaAI website](https://www.pneumaai.app/)
