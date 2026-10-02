export const AUTH_LOGIN_MAX_ATTEMPTS = 5;
export const AUTH_LOGIN_WINDOW_MS = 60_000;

export const AUTH_LOGIN_INCREMENT_SCRIPT = `
  local counts = {}
  for index, key in ipairs(KEYS) do
    local count = redis.call('INCR', key)
    if count == 1 then redis.call('PEXPIRE', key, ARGV[1]) end
    counts[index] = count
  end
  return counts
`;
