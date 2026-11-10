# Clear Path

*An AI-assisted marketing review workspace that helps reviewers triage submissions, inspect policy concerns, and record decisions in one place.*

## Project context

I built Clear Path as a 24-hour take-home project for a startup. The brief was to reduce the bottleneck in a fictional consumer-finance company's spreadsheet-and-email marketing review process.

The prototype focuses on the reviewer's workflow: collect a submission, run a first-pass assessment, inspect specific concerns, and make a human decision. The fictional business and its internal policies provide a concrete setting for demonstrating that workflow.

## Product approach

A single queue brings campaign information, AI evaluation progress, risk, and reviewer decisions together. Rather than making the reviewer open each submission just to understand its priority, the dashboard exposes the information needed to decide what to inspect next.

The key design choice is to separate **evaluation status** from **review status**. An AI assessment can be pending, running, completed, or failed while the human decision remains pending. An evaluated submission is not automatically approved.

## Reviewer workflow

1. **Collect marketing copy.** Add a campaign for a personal loan, credit card, or mortgage prequalification product. Channel-specific fields capture email sender and subject, affiliate identity and domain, or social platform.
2. **Reduce manual entry.** Paste submission text into a parser that extracts labeled fields and marketing copy. The parser uses text patterns; it is separate from the AI review.
3. **Evaluate individually or in a batch.** A submission can be added without evaluation or evaluated immediately. Batch evaluation processes untested or failed entries in the currently displayed queue, with visible progress states.
4. **Triage the queue.** Search campaign details and copy; filter by evaluation, risk, and review status; sort entries, including by numeric risk score. Risk badges and gauges summarize the first-pass assessment.
5. **Inspect the evidence.** Open a submission to see its original content, assessment summary, and findings. Each finding includes a policy identifier, severity, quoted text, reason, and suggested revision.
6. **Record a decision.** Approve, reject, or request changes. Bulk decision actions apply to the currently filtered queue.

The interface keeps an original-submission snapshot when evaluation begins, allowing the reviewer to inspect the material associated with an assessment.

## Architecture

| Component | Implementation | Role |
| --- | --- | --- |
| Dashboard | Next.js App Router, React, TypeScript | Queue, submission form, filters, progress, detail views, and decisions |
| Styling | Tailwind CSS | Responsive layout and visual status indicators |
| Review endpoint | `POST /api/review` | Assemble policy context, request an assessment, and normalize the result |
| Model integration | Google Gen AI SDK | Structured JSON generation using the model configured in the source |
| Shared rules and types | TypeScript modules | Submission contracts and insufficient-context checks |
| Demo data | Twenty seeded submissions | Examples spanning qualified claims, risky language, incomplete copy, and formatting noise |

The dashboard calls a server-side review route, keeping the model API key in the server environment. The current application holds submissions and reviewer decisions in React state. It does not implement a database-backed shared queue or durable storage across reloads.

## Combining AI review with explicit rules

The model receives the campaign, product, channel metadata, and copy together with eight fictional internal policies. These cover approval claims, rate claims, unsupported superlatives, artificial urgency, mortgage prequalification language, misleading claims, submission quality, and insufficient context.

The prompt restricts assessment to those policies and reserves the final decision for a human. A structured response schema requests a numeric risk score, risk label, summary, spam assessment, and a list of findings with explanations and suggestions.

The server then applies deterministic checks. Examples include recognizing explicit guaranteed-approval language, detecting multiple formatting-test signals, and adding an insufficient-context finding for very short copy. A subject containing a financial claim paired with a minimal body also triggers the context check.

The score bands are Low at 0–29, Medium at 30–69, and High at 70–100. These are prototype triage categories, not calibrated probabilities. The implementation also assigns fixed scores to several recognized phrases in the demo examples, so the displayed score reflects a combination of model output and hand-authored rules.

This hybrid approach makes selected behaviors more predictable, but its rules and scores still need evaluation on unseen examples. It also leaves room for inconsistencies between a generated explanation and a rule-adjusted score, which a production implementation should reconcile explicitly.

## Handling latency and failures

Batch evaluation runs sequentially rather than launching every model request at once. Entries move through pending and evaluating states, and failures remain available for another evaluation attempt.

The review endpoint retries temporary rate-limit and service-capacity errors with exponential backoff, with up to three attempts. Other errors return a failed response to the interface. These mechanisms support a usable demonstration, although the batch queue is browser-driven rather than a durable background job system.

## Scope and results

The result is an implemented prototype covering submission intake, AI-assisted triage, evidence inspection, and human decisions. The seeded examples make it possible to demonstrate different risk levels, spam-like content, and incomplete submissions.

The repository does not establish a measured improvement in review throughput or validated assessment accuracy. The intended benefit is less context switching and faster first-pass triage; confirming that benefit would require representative submissions and timed reviewer sessions. This write-up is based on source inspection, without running live model evaluations.

The current scope does not include authentication, role-based permissions, a persistent audit trail, policy versioning, or email and affiliate integrations. It evaluates fictional internal policies rather than providing a general legal-compliance determination.

## Lessons and next steps

The main product lesson is that an AI score is only one part of a review tool. Reviewers also need the original material, specific evidence, clear progress, and a separate place to record their judgment. Batch actions reduce repetitive interaction, but applying decisions to a filtered queue needs clear visibility and would benefit from confirmation and undo.

The next steps would be persistent submissions and decision history, authenticated reviewer roles, versioned policy definitions, and a background evaluation queue. Evaluation should use a labeled set beyond the seeded examples, measuring missed concerns, false alarms, consistency, and reviewer time saved.

## Links and resources

- [Live demo](https://clear-path-ten.vercel.app/)
