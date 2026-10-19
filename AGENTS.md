# GP reconstruction workflow

The user explicitly requires using the `morluto/rea` repository's tools and skills to reconstruct Prism. Read `/workspace/rea/.agents/skills/reverse-engineer-anything/SKILL.md` when available; otherwise locate the installed REA skill. Follow its native/artifact and evidence workflows. Do not silently substitute a guide-driven approximation for reverse engineering.

For each Prism behavior being reconstructed:

1. Identify the specific question, native artifact or resource, and existing evidence. Reuse matching REA snapshots and portable evidence before repeating analysis.
2. Use the applicable REA tools through the connected MCP server or public repository launcher. If one route is unavailable, diagnose it and use a supported alternative. Ordinary shell inspection is supplementary evidence, not REA output.
3. Record artifact hashes, REA Evidence IDs, findings, coverage limits and remaining unknowns. Distinguish static observations, runtime observations, guide statements, user reports and implementation decisions.
4. Implement and test the behavior in GP with normal development tools. Passing GP tests does not establish Prism equivalence. Mark native parity only when the necessary comparison evidence exists.
5. Keep `docs/completion-plan.md`, its requirement registers, and `docs/completion-progress.md` accurate. No placeholder controls or unverified completeness claims.

User-provided installers and extracted proprietary artifacts remain outside Git. Do not modify their original bytes. No running Prism reference is currently available on this Linux host; do not claim otherwise. Published Git commits and production deployment verification are separate facts.
