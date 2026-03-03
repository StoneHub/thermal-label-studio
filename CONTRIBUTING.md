# Contributing

Thanks for your interest in Thermal Label Studio.

## Development setup

```bash
pnpm install
pnpm dev
```

## Before opening a PR

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Guidelines

- Keep changes scoped and explain user impact in PR descriptions.
- Add/adjust tests for reducer logic and utility behavior when possible.
- Do not commit secrets, tokens, `.env` files, or debug logs.
- Prefer clear, typed interfaces over ad-hoc object shapes.

## Bug reports

Please include:

- expected behavior
- actual behavior
- reproduction steps
- screenshots or short screen capture (if UI issue)

