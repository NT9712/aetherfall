// Player inventory + mission state. Pure logic, no rendering — fully
// unit-testable in Node.

export class Inventory {
  constructor() {
    this.amounts = new Map();   // item id -> count
  }
  add(id, n = 1) {
    this.amounts.set(id, (this.amounts.get(id) || 0) + n);
  }
  count(id) { return this.amounts.get(id) || 0; }
  spend(id, n) {
    if (this.count(id) < n) return false;
    const left = this.count(id) - n;
    if (left <= 0) this.amounts.delete(id); else this.amounts.set(id, left);
    return true;
  }
  total() {
    let s = 0;
    for (const v of this.amounts.values()) s += v;
    return s;
  }
}

export class Missions {
  constructor(def, inventory) {
    this.def = def;               // mission definition for the current world
    this.inventory = inventory;
    this.active = null;           // { ...def, kills }
    this.done = false;
  }

  setWorld(def) { this.def = def; this.active = null; this.done = false; }

  get hasActive() { return !!this.active; }
  canAccept() { return !!this.def && !this.active && !this.done; }

  accept() {
    if (!this.canAccept()) return false;
    this.active = { ...this.def, kills: 0 };
    return true;
  }

  onKill() { if (this.active) this.active.kills++; }

  // All item needs (wild pickups + enemy drops alike) must be carried, and the
  // wraith toll met. Returns true when the mission can be handed in.
  fulfilled() {
    if (!this.active) return false;
    for (const [k, v] of Object.entries(this.active.need || {})) {
      if (k === 'wraiths') {
        if (this.active.kills < v) return false;
      } else if (this.inventory.count(k) < v) {
        return false;
      }
    }
    return true;
  }

  turnIn() {
    if (!this.fulfilled()) return null;
    for (const [k, v] of Object.entries(this.active.need)) {
      if (k !== 'wraiths') this.inventory.spend(k, v);
    }
    const reward = this.active.reward;
    this.done = true;
    this.active = null;
    return reward;
  }

  progress() {
    if (!this.active) return null;
    const out = {};
    for (const [k, v] of Object.entries(this.active.need)) {
      if (k === 'wraiths') out[k] = `${Math.min(v, this.active.kills)}/${v}`;
      else out[k] = `${Math.min(v, this.inventory.count(k))}/${v}`;
    }
    return out;
  }
}