export function readConfig(env: Record<string, unknown>) {
  const setting = (key: string, fallback: string) => {
    const value = env[key] ?? fallback;
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid setting: ${key}`);
    return value.trim();
  };
  return { roomId: setting('VITE_ROOM_ID', 'local-room'), actor: setting('VITE_ACTOR', 'student-local') };
}
