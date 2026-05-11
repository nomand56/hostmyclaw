'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Template { id: string; name: string; description: string }
interface Skill { id: string; name: string; description: string }

export default function NewAssistantPage() {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.templates.list(), api.skills.list()]).then(([t, s]) => {
      setTemplates(t.templates as Template[]);
      setSkills(s.skills as Skill[]);
    });
  }, []);

  function toggleSkill(id: string) {
    setSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const assistant = await api.assistants.create({
        name,
        templateId: templateId || undefined,
        skills: selectedSkills,
      });
      window.location.href = `/dashboard/assistants/${(assistant as { id: string }).id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assistant');
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <h1>New assistant</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label>Template</label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">— none —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Skills</label>
          {skills.map((s) => (
            <label key={s.id} style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={selectedSkills.includes(s.id)}
                onChange={() => toggleSkill(s.id)}
              />
              {' '}{s.name}
            </label>
          ))}
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">Create</button>
        <a href="/dashboard" style={{ marginLeft: 12 }}>Cancel</a>
      </form>
    </main>
  );
}
