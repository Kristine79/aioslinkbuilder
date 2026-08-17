# AI Workflows

## Principles

AI is used for semantic work and recommendations.

Deterministic code controls:
- validation
- scoring
- state transitions
- permissions
- provider capabilities
- persistence
- verification rules

## Company analysis

Input:
- company profile
- industry
- geography
- products
- target audience
- campaign goals

Output:
- business type
- topics
- audiences
- relevant categories
- strategic recommendations

Output must be schema validated.

## Opportunity classification

Input:
- platform metadata
- page/content metadata
- company analysis

Output:
- category
- placement type
- topical relevance
- audience match
- geographic relevance
- recommendation reason

## Content preparation

AI may draft:
- company description
- directory description
- outreach draft
- editorial pitch
- profile text

Human approval is required before external publication.

## Provider selection

AI may recommend a provider/method.

The application layer must validate that the selected provider actually supports the required capability.

## Model abstraction

Use an AI provider interface so OpenAI, Anthropic, or another provider can be replaced without changing domain logic.

## Reliability

All model outputs must:
- use structured schemas
- be validated
- have explicit failure handling
- be observable
- avoid direct state mutation
