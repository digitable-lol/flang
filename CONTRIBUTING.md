# Contributing

Run the complete verification loop before proposing a change:

```bash
npm install
npm test
```

Language changes must include:

- a canonical JSON representation;
- parser and semantic-validation tests;
- a schema update when the model changes;
- compatibility notes in `MIGRATION.md`;
- an example for user-visible syntax.

Do not add product-specific structures, filesystem access, or network access to the core library. Build integrations as separate packages over the public `FtsDocument` API.
