import {log, publish} from './common'; // ## DEBUG ONLY
import {OFFSET_ANCHOR, nextId} from './common';
import {TreeWorker} from './traversal';
import {View} from './view';

export class ListState<T> {
  static empty<T>(mutable: boolean): ListState<T> {
    return mutable
      ? new ListState<T>(nextId(), 0, OFFSET_ANCHOR.RIGHT, mutable, View.empty<T>(OFFSET_ANCHOR.LEFT), View.empty<T>(OFFSET_ANCHOR.RIGHT))
      : _defaultEmpty;
  }

  public id = nextId(); // ## DEBUG ONLY

  constructor(
    public group: number,
    public size: number,
    public lastWrite: OFFSET_ANCHOR,
    public mutable: boolean,
    public left: View<T>,
    public right: View<T>
  ) {}

  clone(group: number, mutable: boolean): ListState<T> {
    return new ListState<T>(group, this.size, this.lastWrite, mutable, this.left, this.right);
  }

  toMutable(): ListState<T> {
    return this.clone(nextId(), true);
  }

  toImmutable(done: boolean): ListState<T> {
    if(done) {
      this.mutable = false;
      this.group = nextId(); // Ensure that subsequent read operations don't cause mutations to existing nodes
      return this;
    }
    var state = this.clone(this.group, true);
    this.group = nextId();
    return state;
  }

  getView(anchor: OFFSET_ANCHOR, asWriteTarget: boolean, preferredOrdinal: number = -1): View<T> {
    var view = anchor === OFFSET_ANCHOR.LEFT ? this.left : this.right;
    log(`[ListState#getView (id:${this.id} a:${anchor === OFFSET_ANCHOR.LEFT ? 'L' : 'R'} g:${this.group})] Attempting to retrieve the ${anchor === OFFSET_ANCHOR.LEFT ? 'LEFT' : 'RIGHT'} view from the state object.`); // ## DEBUG ONLY
    if(view.isNone()) {
      log(`[ListState#getView (id:${this.id} a:${anchor === OFFSET_ANCHOR.LEFT ? 'L' : 'R'} g:${this.group})] The requested view (id: ${view.id}) is default empty.`); // ## DEBUG ONLY
      var otherView = anchor === OFFSET_ANCHOR.RIGHT ? this.left : this.right;
      if(!otherView.isNone()) {
        log(`[ListState#getView (id:${this.id} a:${anchor === OFFSET_ANCHOR.LEFT ? 'L' : 'R'} g:${this.group})] The ${anchor === OFFSET_ANCHOR.LEFT ? 'RIGHT' : 'LEFT'} view (${otherView.id}) is currently active.`); // ## DEBUG ONLY
        if(otherView.parent.isNone() || otherView.slot.size + otherView.offset === this.size) {
          log(`[ListState#getView (id:${this.id} a:${anchor === OFFSET_ANCHOR.LEFT ? 'L' : 'R'} g:${this.group})] The ${anchor === OFFSET_ANCHOR.LEFT ? 'RIGHT' : 'LEFT'} view (${otherView.id}) has no parent or is already aligned to its opposite edge, so it will be flipped and used as the requested view.`); // ## DEBUG ONLY
          this.setView(View.empty<T>(otherView.anchor));
          otherView = otherView.cloneToGroup(this.group);
          otherView.flipAnchor(this.size);
          this.setView(view = otherView);
        }
        else {
          log(`[ListState#getView (id:${this.id} a:${anchor === OFFSET_ANCHOR.LEFT ? 'L' : 'R'} g:${this.group})] The ${anchor === OFFSET_ANCHOR.LEFT ? 'RIGHT' : 'LEFT'} view (${otherView.id}) has a parent (id: ${otherView.parent.id}), so it's time to activate the second view.`); // ## DEBUG ONLY
          view = TreeWorker.refocusView<T>(this, otherView, preferredOrdinal !== -1 ? preferredOrdinal : anchor === OFFSET_ANCHOR.LEFT ? 0 : -1, true, true);
          log(`[ListState#getView (id:${this.id} a:${anchor === OFFSET_ANCHOR.LEFT ? 'L' : 'R'} g:${this.group})] The refocusing operation is complete and has returned view (${view.id}, group: ${view.group}) (anchor: ${view.anchor === OFFSET_ANCHOR.LEFT ? 'LEFT' : 'RIGHT'}) as the result.`); // ## DEBUG ONLY
        }
      }
    }
    else log(`[ListState#getView (id:${this.id} a:${anchor === OFFSET_ANCHOR.LEFT ? 'L' : 'R'} g:${this.group})] The requested view is active and can be used.`); // ## DEBUG ONLY
    if(asWriteTarget && !view.isEditable(this.group)) {
      log(`[ListState#getView (id:${this.id} a:${anchor === OFFSET_ANCHOR.LEFT ? 'L' : 'R'} g:${this.group})] The view (${view.id}, group: ${view.group}) is not of the correct group (${this.group}) and needs to be cloned and reassigned to the state object.`); // ## DEBUG ONLY
      this.setView(view = view.cloneToGroup(this.group));
    }
    log(`[ListState#getView (id:${this.id} a:${anchor === OFFSET_ANCHOR.LEFT ? 'L' : 'R'} g:${this.group})] The view (${view.id}) has been retrieved and is ready for use.`); // ## DEBUG ONLY
    return view;
  }

  getOtherView(anchor: OFFSET_ANCHOR): View<T> {
    return anchor === OFFSET_ANCHOR.LEFT ? this.right : this.left;
  }

  setView(view: View<T>): void {
    log(`[ListState#setView (id:${this.id} a:L g:${this.group})] Assign ${view.anchor === OFFSET_ANCHOR.LEFT ? 'LEFT' : 'RIGHT'} view (id: ${view.id}, slot: ${view.slot.id})`); // ## DEBUG ONLY
    if(view.anchor === OFFSET_ANCHOR.LEFT) {
      this.left = view;
    }
    else {
      this.right = view;
    }
  }

  getAtOrdinal(ordinal: number): T|undefined {
    var view = TreeWorker.focusOrdinal<T>(this, ordinal, false);
    if(view === void 0) return void 0;
    return <T>view.slot.slots[ordinal - view.offset];
  }
}

var _defaultEmpty = new ListState<any>(0, 0, OFFSET_ANCHOR.RIGHT, false, View.empty<any>(OFFSET_ANCHOR.LEFT), View.empty<any>(OFFSET_ANCHOR.RIGHT));