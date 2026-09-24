// localStorage throws in private mode and when storage is blocked; every
// caller treats a failure as "nothing saved"
export const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  drop(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};
