# Integrations

## Integration principles

Never invent provider capabilities.

Separate:

- discovery
- read
- create
- update
- status
- verification

A provider may support only some of these.

## Provider capability model

Example:

```text
Provider: ExampleDirectory

discover: true
read: true
create: false
update: false
verify: true
```

## Provider types

### API Provider

Uses an official or authorized API.

### Browser Provider

Uses browser automation where permitted and technically appropriate.

### Manual Provider

Produces a structured task for a human.

### Mock Provider

Used for prototype development and tests.

## Initial real-world provider research

The prototype may contain platform records for:

- Яндекс Бизнес
- 2ГИС
- Мебель.ру
- Мебель от фабрик
- INMYROOM
- SALON-interior
- Design Mate
- Archi.ru
- Houzz
- selected media
- VK
- Telegram
- YouTube
- Дзен
- Pinterest

These are candidate opportunities, not claims that every platform supports automated publication.

For every real platform, document the verified capability before implementing it.

## API cost

Paid APIs are acceptable if required for production integration.

The prototype should not require paid credentials to demonstrate the core workflow. Use MockProvider where credentials are unavailable.

## Security

Provider credentials:
- server-side only
- environment variables
- never committed
- never exposed in frontend bundles
