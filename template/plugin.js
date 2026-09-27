// A starter Moldavite plugin. Rename the folder and the manifest id, then
// replace these two commands with your own. docs/api.md lists all of `api`.

export default function register(api) {
  api.commands.add({
    id: 'insert-greeting',
    label: 'Insert a greeting',
    handler: async () => {
      const values = await api.ui.prompt({
        title: 'Insert a greeting',
        fields: [{ name: 'name', label: 'Who is it for?', type: 'text', required: true }],
        confirmLabel: 'Insert',
      });
      if (!values) return;
      await api.editor.insertText(`Hello, ${values.name}!`);
    },
  });

  api.commands.add({
    id: 'count-words',
    label: 'Count words in this note',
    handler: async () => {
      const note = await api.editor.getActiveNote();
      if (!note) {
        await api.ui.toast('Open a note first', 'error');
        return;
      }
      const text = note.content.replace(/<[^>]+>/g, ' ');
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      await api.ui.toast(`${words} word${words === 1 ? '' : 's'}`, 'success');
    },
  });
}
