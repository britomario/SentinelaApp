# Privacy Compliance for Minors (LGPD/GDPR/COPPA)

## Data categories collected

- Device security telemetry (service health, anti-tamper events)
- Coarse/Fine location for parental safety workflows
- Aggregated emotional signals (no raw conversation content)
- Subscription state and app usage metadata

## Data minimization

- Monitoring payloads are encrypted end-to-end when sensitive.
- Avoid storing raw message/body content in server logs.
- Keep only minimum fields required for parental alerts.

## Legal basis and consent

- Parent/guardian consent is required before child monitoring starts.
- Child account lifecycle must be linked to responsible parent profile.
- Provide clear in-app consent copy for location and safety monitoring.

## Rights handling

- LGPD/GDPR: access, correction, deletion, portability channel.
- COPPA: parental review and deletion of child data.
- Keep an auditable trail of consent and sensitive action changes.

## Security commitments

- No sale of child data.
- No ad profiling from child monitoring data.
- Security incidents must trigger internal response and parent notice flow.
