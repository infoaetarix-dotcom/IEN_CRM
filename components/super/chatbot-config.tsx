'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveChatbotConfig, disableChatbot } from '@/app/super/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Provider = 'openai_compatible' | 'claude';

/**
 * Presets are a convenience, not a restriction — picking one just prefills
 * Base URL + Model, both still editable. "Custom" leaves both blank so a
 * super admin can point at literally any OpenAI-compatible vendor (or a
 * self-hosted proxy) without a code change. Almost every LLM API other than
 * Anthropic's now speaks the OpenAI chat-completions format, which is why
 * one 'openai_compatible' family covers all of these instead of a bespoke
 * integration per vendor.
 */
const PRESETS: Array<{
  key: string;
  label: string;
  provider: Provider;
  baseUrl: string;
  model: string;
}> = [
  { key: 'openai', label: 'OpenAI (ChatGPT)', provider: 'openai_compatible', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { key: 'grok', label: 'Grok (xAI)', provider: 'openai_compatible', baseUrl: 'https://api.x.ai/v1', model: 'grok-4-fast-reasoning' },
  { key: 'gemini', label: 'Gemini (Google)', provider: 'openai_compatible', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-3.6-flash' },
  { key: 'claude', label: 'Claude (Anthropic)', provider: 'claude', baseUrl: '', model: 'claude-sonnet-4-5-20250929' },
  { key: 'custom', label: 'Custom / other API (OpenAI-compatible)', provider: 'openai_compatible', baseUrl: '', model: '' },
];

function guessPresetKey(provider: Provider | null, baseUrl: string | null): string {
  if (!provider) return 'openai';
  const match = PRESETS.find(
    (p) => p.provider === provider && (p.provider === 'claude' || p.baseUrl === baseUrl),
  );
  return match?.key ?? (provider === 'claude' ? 'claude' : 'custom');
}

/**
 * Super Admin's control for the 'chatbot' module row — special-cased in
 * app/super/orgs/[id]/page.tsx instead of the generic ModuleToggle every
 * other module uses, because this one needs a provider + base URL + model +
 * API key saved together with the enable flag, per the exact requested
 * flow: check the box → configure → Save does both the module-enable and
 * the credentials-save as one action.
 */
export function ChatbotConfig({
  orgId,
  moduleName,
  enabled,
  currentProvider,
  currentBaseUrl,
  currentModel,
  maskedKey,
}: {
  orgId: string;
  moduleName: string;
  enabled: boolean;
  currentProvider: Provider | null;
  currentBaseUrl: string | null;
  currentModel: string | null;
  /** Last 4 characters only, e.g. "1a2b" — never the real key. */
  maskedKey: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(enabled);
  const initialPresetKey = guessPresetKey(currentProvider, currentBaseUrl);
  const [presetKey, setPresetKey] = useState(initialPresetKey);
  const [provider, setProvider] = useState<Provider>(
    currentProvider ?? PRESETS.find((p) => p.key === initialPresetKey)!.provider,
  );
  const [baseUrl, setBaseUrl] = useState(currentBaseUrl ?? '');
  const [model, setModel] = useState(
    currentModel ?? PRESETS.find((p) => p.key === initialPresetKey)!.model,
  );
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onToggle(next: boolean) {
    setOpen(next);
    setError(null);
    setSaved(false);
    if (next) return; // reveal the form; nothing saved until Save is clicked
    start(async () => {
      const res = await disableChatbot(orgId);
      if (!res.ok) {
        setError(res.error ?? 'Could not disable.');
        setOpen(true);
      } else {
        router.refresh();
      }
    });
  }

  function onPresetChange(key: string) {
    setPresetKey(key);
    const preset = PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setProvider(preset.provider);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
  }

  function save() {
    setError(null);
    setSaved(false);
    const keyToSave = apiKey.trim();
    if (!keyToSave && !maskedKey) {
      setError('Enter an API key.');
      return;
    }
    if (!model.trim()) {
      setError('Enter a model name.');
      return;
    }
    if (provider === 'openai_compatible' && !baseUrl.trim()) {
      setError('Enter a base URL.');
      return;
    }
    // Blank field with a key already on file — saveChatbotConfig treats ''
    // as "keep the stored key" and only updates provider/model/base URL.
    start(async () => {
      const res = await saveChatbotConfig(orgId, provider, baseUrl, model, keyToSave);
      if (!res.ok) setError(res.error ?? 'Could not save.');
      else {
        setApiKey('');
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="col-span-full rounded-md border border-marketing-ink/10 px-3 py-2 text-sm sm:col-span-2">
      <label className="flex items-center justify-between gap-3">
        <span>{moduleName}</span>
        <Checkbox
          checked={open}
          disabled={pending}
          className="accent-marketing-blue text-marketing-blue"
          onChange={(e) => onToggle(e.target.checked)}
        />
      </label>

      {open && (
        <div className="mt-3 space-y-3 border-t border-marketing-ink/10 pt-3">
          <div className="space-y-1">
            <Label htmlFor={`preset-${orgId}`}>Provider</Label>
            <Select
              id={`preset-${orgId}`}
              value={presetKey}
              disabled={pending}
              onChange={(e) => onPresetChange(e.target.value)}
            >
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          {provider === 'openai_compatible' && (
            <div className="space-y-1">
              <Label htmlFor={`base-url-${orgId}`}>Base URL</Label>
              <Input
                id={`base-url-${orgId}`}
                value={baseUrl}
                disabled={pending}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
              />
              <p className="text-xs text-muted-foreground">
                Up to but not including /chat/completions.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor={`model-${orgId}`}>Model</Label>
            <Input
              id={`model-${orgId}`}
              value={model}
              disabled={pending}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. gpt-4o"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor={`api-key-${orgId}`}>API key</Label>
            <Input
              id={`api-key-${orgId}`}
              type="password"
              autoComplete="off"
              value={apiKey}
              disabled={pending}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={maskedKey ? `••••••••${maskedKey}` : 'Paste the API key'}
            />
            {maskedKey && (
              <p className="text-xs text-muted-foreground">
                A key is already stored. Leave blank to keep it, or paste a new one to replace it.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              className="bg-marketing-blue text-white hover:bg-marketing-blue/90"
              onClick={save}
              disabled={pending}
            >
              {pending ? 'Saving…' : enabled ? 'Update' : 'Create'}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && !error && <p className="text-sm text-emerald-700">Saved — assistant is live.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
