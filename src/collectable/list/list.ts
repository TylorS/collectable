import {log, publish} from './common'; // ## DEBUG ONLY
import {CONST, OFFSET_ANCHOR, isDefined} from './common';
import {append, prepend, setValue, insertValues, deleteValues, createArray, createIterator, ListIterator} from './values';
import {getAtOrdinal} from './traversal';
import {concat} from './concat';
import {slice} from './slice';
import {ListState} from './state';

export type ListMutationCallback<T> = (list: List<T>) => void;

export class List<T> {
  static empty<T>(): List<T> {
    return _emptyList;
  }

  static of<T>(values: T[]): List<T> {
    if(!Array.isArray(values)) {
      throw new Error('First argument must be an array of values');
    }
    var state = ListState.empty<T>(true);
    if(values.length > 0) {
      append(state, values);
    }
    return new List<T>(state.toImmutable(true));
  }

  constructor(public _state: ListState<T>) {
    publish(this, true, `List constructed with size: ${this._state.size}`);
  }

  private _exec(fn: (state: ListState<T>) => ListState<T>|void): List<T> {
    var state = this._state;
    var immutable = !state.mutable;
    if(immutable) {
      state = state.toMutable();
    }
    log(`[List#_exec] List state ${state.id}${this._state.id === state.id ? '' : ` (cloned from id: ${this._state.id})`} will be used for the subsequent list operation.`); // ## DEBUG ONLY
    var nextState = fn(state);
    if(isDefined(nextState)) {
      if(immutable) {
        state = <ListState<T>>nextState;
      }
      else {
        this._state = <ListState<T>>nextState;
      }
    }
    return immutable ? new List<T>(state.toImmutable(true)) : this;
  }

  get size(): number {
    return this._state.size;
  }

  batch(callback: ListMutationCallback<T>): List<T> {
    var state = this._state.toMutable();
    var list = new List<T>(state);
    callback(list);
    state.toImmutable(true);
    return list;
  }

  asMutable(): List<T> {
    if(this._state.mutable) return this;
    return new List<T>(this._state.toMutable());
  }

  asImmutable(finished: boolean): List<T> {
    if(!this._state.mutable) return this;
    if(finished) {
      this._state.toImmutable(true);
      return this;
    }
    return new List<T>(this._state.toImmutable(false));
  }

  get(index: number): T|undefined {
    return getAtOrdinal(this._state, index);
  }

  set(index: number, value: T): List<T> {
    return this._exec(state => setValue(state, index, value));
  }

  append(...values: T[]): List<T>
  append(): List<T> {
    if(arguments.length === 0) return this;
    var state = this._state;
    var immutable = !state.mutable;
    if(immutable) {
      state = state.toMutable();
    }
    var tail = state.right;
    var slot = tail.slot;
    if(arguments.length === 1 && tail.group !== 0 && tail.offset === 0 && slot.group !== 0 && slot.size < CONST.BRANCH_FACTOR) {
      state.lastWrite = OFFSET_ANCHOR.RIGHT;
      state.size++;
      if(slot.group === state.group) {
        slot.adjustRange(0, 1, true);
      }
      else {
        slot = slot.cloneWithAdjustedRange(state.group, 0, 1, true, true);
        if(tail.group !== state.group) {
          tail = tail.cloneToGroup(state.group);
          state.right = tail;
        }
        tail.slot = slot;
      }
      tail.sizeDelta++;
      tail.slotsDelta++;
      slot.slots[slot.slots.length - 1] = arguments[0];
    }
    else {
      append(state, Array.from(arguments));
    }
    return immutable ? new List<T>(state.toImmutable(true)) : this;
  }

  appendArray(values: T[]): List<T> {
    return values.length === 0 ? this
      : this._exec(state => append(state, values));
  }

  prepend(...values: T[]): List<T>
  prepend(): List<T> {
    if(arguments.length === 0) return this;
    var state = this._state;
    var immutable = !state.mutable;
    if(immutable) {
      state = state.toMutable();
    }
    var head = state.left;
    var slot = head.slot;
    if(arguments.length === 1 && head.group !== 0 && head.offset === 0 && slot.group !== 0 && slot.size < CONST.BRANCH_FACTOR) {
      state.lastWrite = OFFSET_ANCHOR.LEFT;
      state.size++;
      if(slot.group === state.group) {
        slot.adjustRange(1, 0, true);
      }
      else {
        slot = slot.cloneWithAdjustedRange(state.group, 1, 0, true, true);
        if(head.group !== state.group) {
          head = head.cloneToGroup(state.group);
          state.left = head;
        }
        head.slot = slot;
      }
      head.sizeDelta++;
      head.slotsDelta++;
      slot.slots[0] = arguments[0];
    }
    else {
      prepend(state, Array.from(arguments));
    }
    return immutable ? new List<T>(state.toImmutable(true)) : this;
  }

  prependArray(values: T[]): List<T> {
    return values.length === 0 ? this
      : this._exec(state => prepend(state, values));
  }

  insert(index: number, ...values: T[]): List<T>
  insert(index: number): List<T> {
    if(arguments.length <= 1) return this;
    var values = new Array<T>(arguments.length - 1);
    for(var i = 1; i < arguments.length; i++) {
      values[i - 1] = arguments[i];
    }
    return this._exec(state => insertValues(state, index, values));
  }

  insertArray(index: number, values: T[]): List<T> {
    if(values.length === 0) return this;
    return this._exec(state => insertValues(state, index, values));
  }

  delete(index: number): List<T> {
    return this._state.size === 0 ? this
      : this._exec(state => deleteValues(state, index, index + 1));
  }

  deleteRange(start: number, end: number): List<T> {
    return this._state.size === 0 ? this
      : this._exec(state => deleteValues(state, start, end));
  }

  pop(): List<T> {
    return this._state.size === 0 ? this
      : this._exec(state => slice(state, 0, -1));
  }

  popFront(): List<T> {
    return this._state.size === 0 ? this
      : this._exec(state => slice(state, 1, state.size));
  }

  skip(count: number): List<T> {
    return this._state.size === 0 || count === 0 ? this
      : this._exec(state => slice(state, count, state.size));
  }

  take(count: number): List<T> {
    return this._state.size === 0 || count >= this._state.size ? this
      : this._exec(state => slice(state, 0, count));
  }

  slice(start: number, end = 0): List<T> {
    if(end === 0) end = this._state.size;
    return this._state.size === 0 ? this
      : this._exec(state => slice(state, start, end));
  }

  concat(...lists: List<T>[]): List<T>
  concat(list: List<T>): List<T> {
    switch(arguments.length) {
      case 0: return this;
      case 1: this._exec(state => concat(state, list._state.toMutable()));
      default:
        var args = Array.from<List<T>>(arguments);
        return this._exec(function(state) {
          for(var i = 0; i < args.length; i++) {
            state = concat(state, args[i]._state.toMutable());
          }
          return state;
        });
    }
  }

  toArray(): T[] {
    return createArray(this._state);
  }

  [Symbol.iterator](): ListIterator<T> {
    return createIterator(this._state);
  }

  values(): ListIterator<T> {
    return createIterator(this._state);
  }
}

export function isDefaultEmptyList(list: List<any>): boolean {
  return list === _emptyList;
}

export var _emptyList = new List<any>(ListState.empty<any>(false));
