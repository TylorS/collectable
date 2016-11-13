import {Slot} from './slot';

var _nextId = 0;
export function nextId() {
  return ++_nextId;
}

export function shiftDownRoundUp(value: number, shift: number): number {
  var a = value >>> shift;
  return a + ((a << shift) < value ? 1 : 0);
}

export function modulo(value: number, shift: number): number {
  return value - ((value >>> shift) << shift);
}

export function concatSlots<T>(left: Slot<T>[], right: Slot<T>[]): Slot<T>[] {
  var arr = new Array<Slot<T>>(left.length + right.length);
  var sum = 0;
  for(var i = 0; i < left.length; i++) {
    arr[i] = left[i];
    arr[i].sum = (sum += left[i].size);
  }
  for(var j = 0; j < right.length; i++, j++) {
    arr[i] = right[j];
    arr[i].sum = (sum += right[j].size);
  }
  return arr;
}

export function concatArray<T>(left: T[], right: T[], spaceBetween: number): T[] {
  var arr = new Array(left.length + right.length + spaceBetween);
  for(var i = 0; i < left.length; i++) {
    arr[i] = left[i];
  }
  i += spaceBetween;
  for(var j = 0; j < right.length; i++, j++) {
    arr[i] = right[j];
  }
  return arr;
}

export function padArrayLeft<T>(values: T[], amount: number): T[] {
  var arr = new Array(values.length + amount);
  for(var i = 0; i < values.length; i++) {
    arr[i + amount] = values[i];
  }
  return arr;
}

export function padArrayRight<T>(values: T[], amount: number): T[] {
  return expandArray(values, values.length + amount);
}

export function expandArray<T>(values: T[], newSize: number): T[] {
  var arr = new Array(newSize);
  for(var i = 0; i < values.length; i++) {
    arr[i] = values[i];
  }
  return arr;
}

export function copyArray<T>(values: T[]): T[] {
  if(values.length > 7) {
    var arr = new Array(values.length);
    for(var i = 0; i < values.length; i++) {
      arr[i] = values[i];
    }
    return arr;
  }
  switch(values.length) {
    case 0: return [];
    case 1:  return [values[0]];
    case 2:  return [values[0], values[1]];
    case 3:  return [values[0], values[1], values[2]];
    case 4:  return [values[0], values[1], values[2], values[3]];
    case 5:  return [values[0], values[1], values[2], values[3], values[4]];
    case 6:  return [values[0], values[1], values[2], values[3], values[4], values[5]];
    case 7:  return [values[0], values[1], values[2], values[3], values[4], values[5], values[6]];
    default: return values.slice(); // never reached, but seems to trigger optimization in V8 for some reason
  }
}

export function truncateFront<T>(values: T[], amount: number): void {
  if(values.length <= amount) {
    values.length = 0;
    return;
  }
  for(var i = 0, j = amount; i < amount; i++, j++) {
    values[i] = values[j];
  }
  values.length -= amount;
}

export function blockCopy<T>(sourceValues: T[], targetValues: T[], sourceIndex: number, destIndex: number, count: number): void {
  for(var i = sourceIndex, j = destIndex, c = 0; c < count; i++, j++, c++) {
    targetValues[j] = sourceValues[i];
  }
}

export function min(a: number, b: number): number {
  return a <= b ? a : b;
}

export function max(a: number, b: number): number {
  return a >= b ? a : b;
}

export function last<T>(array: T[]): T {
  return array[array.length - 1];
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// DEV USE ONLY

export function log(...args: any[])
export function log() {
  publish(Array.from(arguments));
  // console.log.apply(console, arguments);
}

var __publishCallback: Function;
export function publish(...args: any[]): void
export function publish(): void {
  if(__publishCallback) __publishCallback.apply(null, arguments);
}
export function setCallback(callback: Function): void {
  __publishCallback = callback;
}

declare var window;
if(typeof window !== 'undefined') {
  window.addEventListener('error', ev => {
    log(ev.error);
  });
}