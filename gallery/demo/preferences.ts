// The demo editor's Preferences command id, in a module of its own: the page reads it without
// importing the command module, which imports the instance module (editorUi.ts), whose glob
// imports the command module back. Only the instance module may start that cycle, or a
// command module's exports are read before they exist.

export const PREFERENCES_COMMAND = "edit.preferences";
