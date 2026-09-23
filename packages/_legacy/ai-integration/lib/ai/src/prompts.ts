export const DISCOVERY_SYSTEM_PROMPT = `Sei un Discovery & Analysis Agent per un system integrator.
Rispondi SEMPRE e SOLO con un oggetto JSON valido, nessun testo prima o dopo, nessun markdown fence.`;

export function buildDiscoveryPrompt(transcript: string): string {
  return `Analizza la trascrizione di workshop qui sotto ed estrai un output strutturato.

Rispondi SOLO con un oggetto JSON con questa forma esatta:

{
  "requirements": [{ "description": "...", "category": "functional|non_functional|integration", "priority": "high|medium|low" }],
  "risks": [{ "description": "...", "impact": "high|medium|low" }],
  "decisions": [{ "description": "..." }],
  "open_items": [{ "description": "...", "owner": "..." }],
  "scope_boundary": { "in_scope": [], "out_of_scope": [], "assumptions": [], "dependencies": [] },
  "brd": { "title": "...", "summary": "..." },
  "confidence": "high|medium|low",
  "confidence_reason": "obbligatorio se confidence non è high"
}

Regole:
- Ogni voce deve derivare da qualcosa detto esplicitamente nella trascrizione, mai inventata.
- Se la trascrizione è corta/ambigua/incompleta, imposta confidence a "low" o "medium" e spiega il motivo — non compensare inventando contenuto plausibile.
- Se un'assunzione viene corretta durante la conversazione, rifletti la versione corretta.

TRASCRIZIONE:
"""
${transcript}
"""`;
}

export function buildRetryPrompt(originalPrompt: string, validationError: string): string {
  return `${originalPrompt}

ATTENZIONE: il tuo output precedente non era JSON valido secondo lo schema richiesto.
Errore di validazione: ${validationError}
Correggi e rispondi di nuovo SOLO con il JSON valido, nessun altro testo.`;
}
