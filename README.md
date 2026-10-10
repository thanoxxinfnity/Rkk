# Roleplay Playground

Chat with AI characters on any of the 16 free LLM API providers from
[mnfst/awesome-free-llm-apis](https://github.com/mnfst/awesome-free-llm-apis).

- `index.html`: single-page app (Tailwind CDN, vanilla JS). Chat, characters, and a provider directory.
- `api/proxy.js`: Vercel function that forwards each request to the chosen provider with the right
  wire format and auth. Keys come per request from the browser and are never stored or logged.
- `vercel.json`: gives the proxy a 60 second limit.

## Run it

Deploy the folder to Vercel. There is no build step. Open the site, go to **Keys**, paste the keys you
have, and create a character with a provider and model. Providers marked "Key optional" work without a key.

## Data

The provider list, models, rate limits and footnotes are embedded in `index.html` from the upstream
`data.json` (last updated 2026-10-05). Model checks shown in the app come from the upstream
verification run of 2026-07-30. Models marked "not live" were retired or missing from the provider's live
list when checked.
