import { useState } from "react";

export function useArmed() {
  const [armed, setArmed] = useState(null);
  const arm = (name, fn) => {
    if (armed === name) { fn(); setArmed(null); }
    else { setArmed(name); setTimeout(() => setArmed((a) => (a === name ? null : a)), 4000); }
  };
  const isArmed = (name) => armed === name;
  return { arm, isArmed };
}
