# 04 — Rationale variants, hint and audio script (from an APPROVED item)

```
Given an approved item (JSON), produce:
1. rationale_simplified: max 2 sentences, plain language, same facts, no new claims
2. hint: one sentence that points to the decisive cue WITHOUT naming or implying the correct option
3. audio_script: 60-90 words to be read aloud: state the situation cue, the best action and the main reason;
   no option letters, no symbols, spell out abbreviations
Do not add clinical facts that are not already in the approved rationale. Return JSON {id, rationale_simplified, hint, audio_script}.
```
