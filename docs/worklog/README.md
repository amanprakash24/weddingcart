# Daily product development & business work log

Required by the master blueprint (*Revised Doc for Shaadi Shopping & Vivah OS*, v2.0, §97–98, Decision 18): every
working session is recorded with its exact start and end time, so the project stays one connected product instead of
a collection of disconnected features.

- One file per day: `YYYY-MM-DD.md` (IST date). Several sessions on one day go in the same file, one block each.
- Times are IST. When a time is reconstructed (e.g. from GitHub/Vercel timestamps) the entry says so.
- Roadmap and backlog: [`../wedding-os/13-roadmap-v2.md`](../wedding-os/13-roadmap-v2.md).

## Entry format (§97)

```
## Session N
- Date: DD/MM/YYYY
- Start: HH:MM IST
- End: HH:MM IST

### Main objective
### Product discussion
### Decisions made
### Development work
### Repository areas
### Testing
### Problems found
### Problems resolved
### Pending work
### Next operational block
### Business impact        (revenue · customer · vendor · operations · SaaS · commission · scalability)
### Future integration notes
```

## Master rule (§98)

Start → understand current state → define today's operational block → inspect existing implementation → make a
controlled change → test → verify → record decision → record pending work → end.
